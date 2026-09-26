import { detectAccountKind, previewFromRows, stampAccountKind } from "./account";
import { classifyCashType, isFooterLabel, isIgnorableRow } from "./classify";
import {
  findHeader,
  getCell,
  isCashHeader,
  isOpenPositionDetailHeader,
  isTradeHeader,
  type ColumnMap,
} from "./headers";
import type { AccountKind, CashOperation, ClosedPosition, OpenPosition, ParsedXtbFile } from "./types";
import { cellText, normalizeHeader, parseAmount, parseDate } from "./values";

function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(buffer);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(buffer);
  }
  return new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
}

function detectDelimiter(sample: string): string {
  const line = sample.split(/\r?\n/).find((entry) => entry.trim()) ?? "";
  const commas = (line.match(/,/g) ?? []).length;
  const semicolons = (line.match(/;/g) ?? []).length;
  const tabs = (line.match(/\t/g) ?? []).length;
  if (tabs > semicolons && tabs > commas) {
    return "\t";
  }
  return semicolons >= commas ? ";" : ",";
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

function parseCashRows(
  rows: unknown[][],
  map: ColumnMap,
  startIndex: number,
  accountKind: AccountKind,
): CashOperation[] {
  const operations: CashOperation[] = [];

  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const rawType = cellText(getCell(row, map, "type"));
    if (!rawType || isIgnorableRow(rawType)) {
      continue;
    }

    const amount = parseAmount(getCell(row, map, "amount"));
    const time = parseDate(getCell(row, map, "time"));
    if (amount == null || !time) {
      continue;
    }

    operations.push({
      id: cellText(getCell(row, map, "id")) || String(index),
      kind: classifyCashType(rawType),
      rawType,
      time,
      comment: cellText(getCell(row, map, "comment")),
      symbol: cellText(getCell(row, map, "symbol")),
      amount,
      accountKind,
    });
  }

  return operations;
}

function parseTradeRows(
  rows: unknown[][],
  map: ColumnMap,
  startIndex: number,
  accountKind: AccountKind,
): ClosedPosition[] {
  const positions: ClosedPosition[] = [];

  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const symbol = cellText(getCell(row, map, "symbol"));
    if (isFooterLabel(symbol) || isFooterLabel(cellText(getCell(row, map, "type")))) {
      continue;
    }
    const closeTime = parseDate(getCell(row, map, "closeTime"));
    const openTime = parseDate(getCell(row, map, "openTime"));
    // New xStation "Open Positions" has open time and P/L but no close time.
    // Only fall back to open time when the closed-positions table has no close column.
    const time = closeTime ?? (map.closeTime == null ? openTime : null);
    const gross = parseAmount(getCell(row, map, "grossProfit"));
    const netColumn = parseAmount(getCell(row, map, "netProfit"));
    const commission = parseAmount(getCell(row, map, "commission")) ?? 0;
    const swap = parseAmount(getCell(row, map, "swap")) ?? 0;
    const rollover = parseAmount(getCell(row, map, "rollover")) ?? 0;

    if (!symbol || !time) {
      continue;
    }

    const netProfit =
      netColumn ?? (gross != null ? gross + commission + swap + rollover : null);
    if (netProfit == null) {
      continue;
    }

    const grossProfit = gross ?? netProfit - commission - swap - rollover;

    positions.push({
      position: cellText(getCell(row, map, "position")) || String(index),
      symbol,
      type: cellText(getCell(row, map, "type")),
      volume: parseAmount(getCell(row, map, "volume")),
      openTime,
      closeTime: time,
      openPrice: parseAmount(getCell(row, map, "openPrice")),
      commission,
      swap,
      rollover,
      grossProfit: grossProfit ?? netProfit - commission - swap - rollover,
      netProfit,
      comment: cellText(getCell(row, map, "comment")),
      accountKind,
    });
  }

  return positions;
}

export function parseOpenPositionRows(
  rows: unknown[][],
  accountKind: AccountKind,
): OpenPosition[] {
  const header =
    findHeader(rows, isOpenPositionDetailHeader) ?? findHeader(rows, isTradeHeader);
  if (!header) {
    return [];
  }

  const positions: OpenPosition[] = [];

  for (let index = header.index + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const symbol = cellText(getCell(row, header.map, "symbol"));
    if (!symbol || isFooterLabel(symbol) || isFooterLabel(cellText(getCell(row, header.map, "type")))) {
      continue;
    }

    const netColumn = parseAmount(getCell(row, header.map, "netProfit"));
    const grossProfit = parseAmount(getCell(row, header.map, "grossProfit"));
    const value = parseAmount(getCell(row, header.map, "amount"));
    const volume = parseAmount(getCell(row, header.map, "volume"));
    const openTime = parseDate(getCell(row, header.map, "openTime"));
    const openPrice = parseAmount(getCell(row, header.map, "openPrice"));

    if (volume == null && value == null && netColumn == null && grossProfit == null) {
      continue;
    }

    positions.push({
      symbol,
      netProfit: netColumn ?? 0,
      grossProfit: grossProfit ?? undefined,
      value: value ?? undefined,
      volume: volume ?? null,
      openTime: openTime ?? null,
      openPrice: openPrice ?? null,
      accountKind,
    });
  }

  return positions;
}

export function parseTableRows(
  rows: unknown[][],
  sourceName: string,
  warnings: string[] = [],
  accountKind: AccountKind = "standard",
): Pick<ParsedXtbFile, "cashOperations" | "closedPositions"> & { foundHeader: boolean } {
  const cashHeader = findHeader(rows, isCashHeader);
  const tradeHeader = findHeader(rows, isTradeHeader);

  const cashOperations = cashHeader
    ? parseCashRows(rows, cashHeader.map, cashHeader.index + 1, accountKind)
    : [];
  const closedPositions = tradeHeader
    ? parseTradeRows(rows, tradeHeader.map, tradeHeader.index + 1, accountKind)
    : [];

  const foundHeader = Boolean(cashHeader || tradeHeader);
  if (!foundHeader) {
    warnings.push(`Nie rozpoznano nagłówków XTB w pliku ${sourceName}.`);
  }

  return { cashOperations, closedPositions, foundHeader };
}

function headerLabel(value: unknown): string {
  return normalizeHeader(cellText(value))
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseOpenPositionsSummary(rows: unknown[][]): { value: number; profit: number } | null {
  const limit = Math.min(rows.length, 40);
  let headerIndex = -1;
  let metricIndex = 1;
  let amountIndex = 2;

  for (let index = 0; index < limit; index += 1) {
    const row = rows[index] ?? [];
    const labels = row.map(headerLabel);
    const metric = labels.indexOf("metric");
    const amount = labels.findIndex((label) => label === "amount" || label === "value");
    const product = labels.indexOf("product");
    if (product >= 0 && metric >= 0 && amount >= 0) {
      headerIndex = index;
      metricIndex = metric;
      amountIndex = amount;
      break;
    }
  }

  if (headerIndex < 0) {
    return null;
  }

  let value = 0;
  let profit = 0;
  let sawMetric = false;

  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const metric = headerLabel(row[metricIndex]);
    if (!metric || metric === "note" || metric === "product") {
      break;
    }
    const amount = parseAmount(row[amountIndex]);
    if (amount == null) {
      continue;
    }
    // Aktualny xStation: "Open position value" / "Open position profit".
    // Starszy eksport: samo "Value" / "Profit".
    if (metric === "value" || metric.endsWith("position value")) {
      value += amount;
      sawMetric = true;
    } else if (metric === "profit" || metric.endsWith("position profit")) {
      profit += amount;
      sawMetric = true;
    }
  }

  return sawMetric ? { value, profit } : null;
}

export function parseCsvText(text: string, sourceName = "import.csv"): ParsedXtbFile {
  const warnings: string[] = [];
  const delimiter = detectDelimiter(text);
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => splitCsvLine(line, delimiter));
  const accountKind = detectAccountKind(sourceName, previewFromRows(rows));
  const parsed = parseTableRows(rows, sourceName, warnings, accountKind);
  return stampAccountKind(
    {
      sourceName,
      accountKind,
      warnings,
      cashOperations: parsed.cashOperations,
      closedPositions: parsed.closedPositions,
      recognized: parsed.foundHeader,
    },
    accountKind,
  );
}

export function parseCsvBuffer(buffer: ArrayBuffer, sourceName: string): ParsedXtbFile {
  return parseCsvText(decodeText(buffer), sourceName);
}
