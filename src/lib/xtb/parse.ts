import { parseCsvBuffer } from "./parse-table";
import { parseXlsxBuffer } from "./parse-xlsx";
import type { ParsedXtbFile } from "./types";

function isSpreadsheet(fileName: string): boolean {
  return /\.(xlsx|xlsm)$/i.test(fileName);
}

function isCsv(fileName: string): boolean {
  return /\.(csv|txt|tsv)$/i.test(fileName);
}

export async function parseXtbFile(file: File): Promise<ParsedXtbFile> {
  const buffer = await file.arrayBuffer();
  return parseXtbBuffer(buffer, file.name);
}

export async function parseXtbBuffer(
  buffer: ArrayBuffer,
  sourceName: string,
): Promise<ParsedXtbFile> {
  if (isSpreadsheet(sourceName)) {
    return Promise.resolve(parseXlsxBuffer(buffer, sourceName));
  }

  if (isCsv(sourceName)) {
    return parseCsvBuffer(buffer, sourceName);
  }

  const asCsv = parseCsvBuffer(buffer, sourceName);
  if (asCsv.cashOperations.length > 0 || asCsv.closedPositions.length > 0) {
    return asCsv;
  }

  try {
    return await parseXlsxBuffer(buffer, sourceName);
  } catch {
    asCsv.warnings.push("Nie udało się rozpoznać formatu pliku. Użyj XLSX lub CSV z xStation.");
    return asCsv;
  }
}
