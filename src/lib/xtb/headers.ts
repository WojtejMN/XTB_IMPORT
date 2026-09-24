import { cellText, normalizeHeader } from "./values";

export type ColumnRole =
  | "id"
  | "type"
  | "time"
  | "comment"
  | "symbol"
  | "amount"
  | "position"
  | "volume"
  | "openTime"
  | "closeTime"
  | "openPrice"
  | "closePrice"
  | "commission"
  | "swap"
  | "rollover"
  | "grossProfit"
  | "netProfit";

const HEADER_ALIASES: Record<ColumnRole, string[]> = {
  id: ["id", "nr"],
  type: ["type", "typ", "operation", "operacja"],
  time: ["time", "czas", "date", "data"],
  comment: ["comment", "komentarz", "description", "opis"],
  // "symbol" / "instrument" są rozwiązywane osobno — preferujemy kolumnę Ticker.
  symbol: ["symbol"],
  amount: ["amount", "kwota", "value", "wartosc", "suma"],
  position: ["position", "pozycja", "ticket", "order", "position id"],
  volume: ["volume", "wolumen", "lots"],
  openTime: ["open time", "openTime", "czas otwarcia", "open date", "open time utc"],
  closeTime: ["close time", "closeTime", "czas zamkniecia", "czas zamknięcia", "close date", "close time utc"],
  openPrice: ["open price", "cena otwarcia"],
  closePrice: ["close price", "cena zamkniecia", "cena zamknięcia", "market price", "current price"],
  commission: ["commission", "prowizja"],
  swap: ["swap"],
  rollover: ["rollover"],
  grossProfit: ["gross p/l", "gross pl", "gross p l", "gross profit"],
  netProfit: ["profit", "zysk", "net p/l", "net pl", "net profit", "profit loss", "profit/loss"],
};

function canonicalize(value: string): string {
  return normalizeHeader(value)
    .replace(/\([^)]*\)/g, " ")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l")
    .replace(/\s+/g, " ")
    .trim();
}

function roleForHeader(header: string): ColumnRole | null {
  const normalized = canonicalize(header);

  for (const [role, aliases] of Object.entries(HEADER_ALIASES) as [ColumnRole, string[]][]) {
    if (aliases.some((alias) => normalized === canonicalize(alias))) {
      return role;
    }
  }

  return null;
}

export type ColumnMap = Partial<Record<ColumnRole, number>>;

/**
 * Mapuje wiersz nagłówka. Gdy są obie kolumny Instrument i Ticker,
 * bierzemy Ticker (np. CDR.PL), nie nazwę spółki.
 */
export function mapHeaderRow(row: unknown[]): ColumnMap {
  const map: ColumnMap = {};
  let tickerCol: number | undefined;
  let symbolCol: number | undefined;
  let instrumentCol: number | undefined;

  row.forEach((cell, index) => {
    const normalized = canonicalize(cellText(cell));
    if (!normalized) {
      return;
    }
    if (normalized === "ticker") {
      tickerCol = index;
      return;
    }
    if (normalized === "symbol") {
      symbolCol = index;
      return;
    }
    if (normalized === "instrument" || normalized.startsWith("instrument ")) {
      instrumentCol = index;
      return;
    }

    const role = roleForHeader(cellText(cell));
    if (role && map[role] == null) {
      map[role] = index;
    }
  });

  const preferredSymbol = tickerCol ?? symbolCol ?? instrumentCol;
  if (preferredSymbol != null) {
    map.symbol = preferredSymbol;
  }

  return map;
}

export function isCashHeader(map: ColumnMap): boolean {
  return map.type != null && map.amount != null;
}

export function isTradeHeader(map: ColumnMap): boolean {
  const hasProfit = map.grossProfit != null || map.netProfit != null;
  const hasTradeShape =
    (map.symbol != null && (map.closeTime != null || map.openTime != null)) ||
    map.position != null ||
    map.volume != null;
  return hasProfit && hasTradeShape;
}

/** Szczegóły Open Positions: Ticker + Volume (+ Value / Profit). */
export function isOpenPositionDetailHeader(map: ColumnMap): boolean {
  return map.symbol != null && map.volume != null && (map.amount != null || map.netProfit != null);
}

export function findHeader(
  rows: unknown[][],
  predicate: (map: ColumnMap) => boolean,
): { index: number; map: ColumnMap } | null {
  const limit = Math.min(rows.length, 40);
  for (let index = 0; index < limit; index += 1) {
    const map = mapHeaderRow(rows[index] ?? []);
    if (predicate(map)) {
      return { index, map };
    }
  }
  return null;
}

export function getCell(row: unknown[], map: ColumnMap, role: ColumnRole): unknown {
  const index = map[role];
  if (index == null) {
    return "";
  }
  return row[index];
}
