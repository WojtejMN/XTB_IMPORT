import { classifyCashType, isIgnorableRow } from "./classify";
import {
  findHeader,
  getCell,
  isCashHeader,
  isTradeHeader,
  type ColumnMap,
} from "./headers";
import type { CashOperation, ClosedPosition, ParsedXtbFile } from "./types";
import { cellText, parseAmount, parseDate } from "./values";

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

function parseCashRows(rows: unknown[][], map: ColumnMap, startIndex: number): CashOperation[] {
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
    });
  }

  return operations;
}

function parseTradeRows(rows: unknown[][], map: ColumnMap, startIndex: number): ClosedPosition[] {
  const positions: ClosedPosition[] = [];

  for (let index = startIndex; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const symbol = cellText(getCell(row, map, "symbol"));
    const closeTime =
      parseDate(getCell(row, map, "closeTime")) ?? parseDate(getCell(row, map, "openTime"));
    const gross = parseAmount(getCell(row, map, "grossProfit"));
    const netColumn = parseAmount(getCell(row, map, "netProfit"));
    const commission = parseAmount(getCell(row, map, "commission")) ?? 0;
    const swap = parseAmount(getCell(row, map, "swap")) ?? 0;
    const rollover = parseAmount(getCell(row, map, "rollover")) ?? 0;

    if (!symbol || !closeTime) {
      continue;
    }

    const grossProfit = gross ?? (netColumn != null ? netColumn - commission - swap - rollover : null);
    if (grossProfit == null && netColumn == null) {
      continue;
    }

    const netProfit =
      netColumn != null && gross == null
        ? netColumn
        : (grossProfit ?? 0) + commission + swap + rollover;

    positions.push({
      position: cellText(getCell(row, map, "position")) || String(index),
      symbol,
      type: cellText(getCell(row, map, "type")),
      volume: parseAmount(getCell(row, map, "volume")),
      openTime: parseDate(getCell(row, map, "openTime")),
      closeTime,
      commission,
      swap,
      rollover,
      grossProfit: grossProfit ?? netProfit - commission - swap - rollover,
      netProfit,
      comment: cellText(getCell(row, map, "comment")),
    });
  }

  return positions;
}

export function parseTableRows(
  rows: unknown[][],
  sourceName: string,
  warnings: string[] = [],
): Pick<ParsedXtbFile, "cashOperations" | "closedPositions"> {
  const cashHeader = findHeader(rows, isCashHeader);
  const tradeHeader = findHeader(rows, isTradeHeader);

  const cashOperations = cashHeader
    ? parseCashRows(rows, cashHeader.map, cashHeader.index + 1)
    : [];
  const closedPositions = tradeHeader
    ? parseTradeRows(rows, tradeHeader.map, tradeHeader.index + 1)
    : [];

  if (!cashHeader && !tradeHeader) {
    warnings.push(`Nie rozpoznano nagłówków XTB w pliku ${sourceName}.`);
  }

  return { cashOperations, closedPositions };
}

export function parseCsvText(text: string, sourceName = "import.csv"): ParsedXtbFile {
  const warnings: string[] = [];
  const delimiter = detectDelimiter(text);
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => splitCsvLine(line, delimiter));

  const parsed = parseTableRows(rows, sourceName, warnings);
  return {
    sourceName,
    warnings,
    ...parsed,
  };
}

export function parseCsvBuffer(buffer: ArrayBuffer, sourceName: string): ParsedXtbFile {
  return parseCsvText(decodeText(buffer), sourceName);
}
