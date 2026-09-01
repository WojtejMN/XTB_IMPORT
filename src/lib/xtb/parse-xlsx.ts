import { unzipSync } from "fflate";
import { XMLParser } from "fast-xml-parser";
import { parseTableRows } from "./parse-table";
import type { ParsedXtbFile } from "./types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function decode(files: Record<string, Uint8Array>, path: string): string | null {
  const match = Object.keys(files).find((key) => key.replace(/\\/g, "/").toLowerCase() === path.toLowerCase());
  if (!match) {
    return null;
  }
  return new TextDecoder("utf-8").decode(files[match]);
}

function columnIndex(cellRef: string | undefined): number {
  const letters = cellRef?.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index - 1;
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) {
    return [];
  }
  const parsed = xmlParser.parse(xml) as {
    sst?: { si?: unknown };
  };
  return asArray(parsed.sst?.si).map((item) => readInlineText(item));
}

function readInlineText(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  if (typeof value !== "object") {
    return "";
  }

  const node = value as { t?: unknown; r?: unknown; is?: unknown };
  if (node.t != null) {
    return asArray(node.t)
      .map((part) => (typeof part === "object" && part && "#text" in part ? String((part as { "#text": string })["#text"]) : String(part)))
      .join("");
  }
  if (node.r != null) {
    return asArray(node.r).map(readInlineText).join("");
  }
  if (node.is != null) {
    return readInlineText(node.is);
  }
  return "";
}

function cellValue(cell: Record<string, unknown>, sharedStrings: string[]): unknown {
  const type = String(cell["@_t"] ?? "");
  if (type === "s") {
    const index = Number(cell.v);
    return Number.isFinite(index) ? (sharedStrings[index] ?? "") : "";
  }
  if (type === "inlineStr") {
    return readInlineText(cell.is);
  }
  if (type === "b") {
    return String(cell.v) === "1";
  }
  if (cell.v == null) {
    return "";
  }
  const raw = cell.v;
  if (typeof raw === "number") {
    return raw;
  }
  const asNumber = Number(raw);
  if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(asNumber) && type !== "str") {
    return asNumber;
  }
  return raw;
}

function parseSheetRows(xml: string, sharedStrings: string[]): unknown[][] {
  const parsed = xmlParser.parse(xml) as {
    worksheet?: { sheetData?: { row?: unknown } };
  };
  const rows = asArray(parsed.worksheet?.sheetData?.row);
  return rows.map((row) => {
    const cells = asArray((row as { c?: unknown }).c) as Record<string, unknown>[];
    const values: unknown[] = [];
    for (const cell of cells) {
      const index = columnIndex(String(cell["@_r"] ?? ""));
      values[index] = cellValue(cell, sharedStrings);
    }
    return values;
  });
}

function workbookSheets(
  files: Record<string, Uint8Array>,
): { name: string; path: string }[] {
  const workbookXml = decode(files, "xl/workbook.xml");
  const relsXml = decode(files, "xl/_rels/workbook.xml.rels");
  if (!workbookXml) {
    return [];
  }

  const workbook = xmlParser.parse(workbookXml) as {
    workbook?: { sheets?: { sheet?: unknown } };
  };
  const rels = relsXml
    ? (xmlParser.parse(relsXml) as { Relationships?: { Relationship?: unknown } })
    : null;
  const relMap = new Map<string, string>();
  for (const rel of asArray(rels?.Relationships?.Relationship) as Record<string, string>[]) {
    relMap.set(rel["@_Id"], rel["@_Target"]);
  }

  return asArray(workbook.workbook?.sheets?.sheet).map((sheet, index) => {
    const node = sheet as Record<string, string>;
    const target =
      relMap.get(node["@_id"] ?? "") ??
      relMap.get(node["@_r:id"] ?? "") ??
      relMap.get(node["@_rid"] ?? "") ??
      [...relMap.values()][index] ??
      "";
    const normalized = target.replace(/^\//, "").replace(/^xl\//, "");
    return {
      name: node["@_name"] ?? "Arkusz",
      path: `xl/${normalized}`,
    };
  });
}

export function parseXlsxBuffer(buffer: ArrayBuffer, sourceName: string): ParsedXtbFile {
  const files = unzipSync(new Uint8Array(buffer));
  const warnings: string[] = [];
  const parsed: ParsedXtbFile = {
    sourceName,
    cashOperations: [],
    closedPositions: [],
    warnings,
  };

  const sharedStrings = parseSharedStrings(decode(files, "xl/sharedStrings.xml"));
  const sheets = workbookSheets(files);

  for (const sheet of sheets) {
    const xml = decode(files, sheet.path);
    if (!xml) {
      continue;
    }
    const rows = parseSheetRows(xml, sharedStrings);
    const table = parseTableRows(rows, `${sourceName} / ${sheet.name}`, warnings);
    parsed.cashOperations.push(...table.cashOperations);
    parsed.closedPositions.push(...table.closedPositions);
  }

  if (parsed.cashOperations.length === 0 && parsed.closedPositions.length === 0) {
    warnings.push("Plik XLSX nie zawiera rozpoznawalnej historii XTB.");
  }

  return parsed;
}
