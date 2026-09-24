import type { ParsedXtbFile } from "../xtb/types";

export type PriceSyncRequest = {
  xtbTicker: string;
  startDate: string; // YYYY-MM-DD
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Z historii XTB buduje listę unikalnych tickerów z datą pierwszej transakcji.
 * Nie wysyła pełnej historii — tylko ticker + min data.
 */
export function collectTickerStartDates(parsed: ParsedXtbFile): PriceSyncRequest[] {
  const earliest = new Map<string, number>();

  function bump(symbol: string, time: Date | null | undefined) {
    const ticker = symbol.trim().toUpperCase();
    if (!ticker || !time || Number.isNaN(time.getTime())) {
      return;
    }
    const ms = time.getTime();
    const prev = earliest.get(ticker);
    if (prev == null || ms < prev) {
      earliest.set(ticker, ms);
    }
  }

  for (const operation of parsed.cashOperations) {
    if (!operation.symbol.trim()) {
      continue;
    }
    if (
      operation.kind === "purchase" ||
      operation.kind === "sale" ||
      operation.kind === "dividend" ||
      operation.kind === "withholding_tax" ||
      operation.kind === "stock_split"
    ) {
      bump(operation.symbol, operation.time);
    }
  }

  for (const position of parsed.closedPositions) {
    bump(position.symbol, position.openTime ?? position.closeTime);
  }

  for (const position of parsed.openPositions ?? []) {
    // Brak daty otwarcia w podsumowaniu — wystarczy zsynchronizować bieżące ceny.
    bump(position.symbol, new Date());
  }

  return [...earliest.entries()]
    .map(([xtbTicker, ms]) => ({
      xtbTicker,
      startDate: toIsoDate(new Date(ms)),
    }))
    .sort((a, b) => a.xtbTicker.localeCompare(b.xtbTicker));
}

/** Scala tickery z wielu plików — najwcześniejsza data startu wygrywa. */
export function collectTickerStartDatesFromFiles(files: ParsedXtbFile[]): PriceSyncRequest[] {
  const map = new Map<string, string>();
  for (const file of files) {
    for (const item of collectTickerStartDates(file)) {
      const prev = map.get(item.xtbTicker);
      if (!prev || item.startDate < prev) {
        map.set(item.xtbTicker, item.startDate);
      }
    }
  }
  return [...map.entries()]
    .map(([xtbTicker, startDate]) => ({ xtbTicker, startDate }))
    .sort((a, b) => a.xtbTicker.localeCompare(b.xtbTicker));
}
