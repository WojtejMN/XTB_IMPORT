import { duplicatesClosedPositionPnl } from "./classify";
import type { CashKind, ParsedXtbFile, SymbolProfit } from "./types";

/** Grupuje warianty tickera (np. ASBIS.PL → ASBIS). */
export function normalizeSymbolKey(symbol: string): string {
  const trimmed = symbol.trim();
  if (!trimmed) {
    return "NIEZNANY";
  }
  return trimmed
    .replace(/\.(PL|US|DE|UK|FR|NL|EU|WA|PA)$/i, "")
    .toUpperCase();
}

function isSymbolCashProfitKind(kind: CashKind): boolean {
  return (
    kind === "dividend" ||
    kind === "withholding_tax" ||
    kind === "commission" ||
    kind === "interest_tax" ||
    kind === "swap" ||
    kind === "profit_loss"
  );
}

export function aggregateSymbolProfits(parsed: ParsedXtbFile): SymbolProfit[] {
  const hasClosedPositions = parsed.closedPositions.length > 0;
  const map = new Map<string, SymbolProfit>();

  function bump(
    rawSymbol: string,
    profitDelta: number,
    saleDelta = 0,
    openDelta = 0,
  ) {
    const key = normalizeSymbolKey(rawSymbol);
    const existing = map.get(key) ?? {
      symbol: rawSymbol.trim() || key,
      profit: 0,
      trades: 0,
      openPositions: 0,
    };
    existing.profit += profitDelta;
    existing.trades += saleDelta;
    existing.openPositions += openDelta;
    map.set(key, existing);
  }

  for (const position of parsed.closedPositions) {
    bump(position.symbol, position.netProfit, 1, 0);
  }

  for (const position of parsed.openPositions ?? []) {
    bump(position.symbol, position.netProfit, 0, 1);
  }

  for (const operation of parsed.cashOperations) {
    const symbol = operation.symbol.trim();
    if (!symbol) {
      continue;
    }

    if (hasClosedPositions && duplicatesClosedPositionPnl(operation.kind)) {
      continue;
    }

    if (operation.kind === "purchase" || operation.kind === "sale") {
      bump(symbol, operation.amount, operation.kind === "sale" ? 1 : 0, 0);
      continue;
    }

    if (isSymbolCashProfitKind(operation.kind)) {
      bump(symbol, operation.amount, 0, 0);
    }
  }

  return [...map.values()].sort((a, b) => b.profit - a.profit);
}
