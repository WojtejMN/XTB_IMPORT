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

type SymbolAccumulator = {
  symbol: string;
  closedProfit: number;
  openProfit: number;
  openCostBasis: number;
  purchases: number;
  sales: number;
  otherCash: number;
  trades: number;
  openPositions: number;
};

function computeSymbolProfit(acc: SymbolAccumulator): number {
  let profit = acc.closedProfit + acc.otherCash + acc.sales;

  if (acc.openPositions > 0) {
    profit += acc.openProfit;
    if (acc.openCostBasis > 0) {
      // Koszt trzymanych akcji kompensuje kupna — unikamy podwójnego liczenia.
      profit += acc.purchases + acc.openCostBasis;
    }
  } else {
    profit += acc.purchases;
  }

  return profit;
}

export function aggregateSymbolProfits(parsed: ParsedXtbFile): SymbolProfit[] {
  const hasClosedPositions = parsed.closedPositions.length > 0;
  const map = new Map<string, SymbolAccumulator>();

  function getAccumulator(rawSymbol: string): SymbolAccumulator {
    const key = normalizeSymbolKey(rawSymbol);
    const existing = map.get(key);
    if (existing) {
      return existing;
    }
    const created: SymbolAccumulator = {
      symbol: rawSymbol.trim() || key,
      closedProfit: 0,
      openProfit: 0,
      openCostBasis: 0,
      purchases: 0,
      sales: 0,
      otherCash: 0,
      trades: 0,
      openPositions: 0,
    };
    map.set(key, created);
    return created;
  }

  for (const position of parsed.closedPositions) {
    const acc = getAccumulator(position.symbol);
    acc.closedProfit += position.netProfit;
    acc.trades += 1;
  }

  for (const position of parsed.openPositions ?? []) {
    const acc = getAccumulator(position.symbol);
    acc.openProfit += position.netProfit;
    acc.openPositions += 1;
    if (position.value != null) {
      acc.openCostBasis += position.value - position.netProfit;
    }
  }

  for (const operation of parsed.cashOperations) {
    const symbol = operation.symbol.trim();
    if (!symbol) {
      continue;
    }

    if (hasClosedPositions && duplicatesClosedPositionPnl(operation.kind)) {
      continue;
    }

    const acc = getAccumulator(symbol);

    if (operation.kind === "purchase") {
      acc.purchases += operation.amount;
      continue;
    }

    if (operation.kind === "sale") {
      acc.sales += operation.amount;
      acc.trades += 1;
      continue;
    }

    if (isSymbolCashProfitKind(operation.kind)) {
      acc.otherCash += operation.amount;
    }
  }

  return [...map.values()]
    .map(
      (acc): SymbolProfit => ({
        symbol: acc.symbol,
        profit: computeSymbolProfit(acc),
        trades: acc.trades,
        openPositions: acc.openPositions,
      }),
    )
    .sort((a, b) => b.profit - a.profit);
}
