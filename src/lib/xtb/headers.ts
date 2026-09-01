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
  symbol: ["symbol", "instrument", "ticker"],
  amount: ["amount", "kwota", "value", "wartosc", "suma"],
  position: ["position", "pozycja", "ticket", "order", "position id"],
  volume: ["volume", "wolumen", "lots"],
  openTime: ["open time", "openTime", "czas otwarcia", "open date", "open time utc"],
  closeTime: ["close time", "closeTime", "czas zamkniecia", "czas zamknięcia", "close date", "close time utc"],
  openPrice: ["open price", "cena otwarcia"],
  closePrice: ["close price", "cena zamkniecia", "cena zamknięcia", "market price"],
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

export function mapHeaderRow(row: unknown[]): ColumnMap {
  const map: ColumnMap = {};
  row.forEach((cell, index) => {
    const role = roleForHeader(cellText(cell));
    if (role && map[role] == null) {
      map[role] = index;
    }
  });
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
