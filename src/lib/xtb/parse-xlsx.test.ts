import { zipSync, strToU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { parseXlsxBuffer } from "./parse-xlsx";

function colLetter(index: number): string {
  let value = index + 1;
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildXlsx(sheets: { name: string; rows: unknown[][] }[]): ArrayBuffer {
  const shared: string[] = [];
  const indexOf = (text: string) => {
    const existing = shared.indexOf(text);
    if (existing >= 0) {
      return existing;
    }
    shared.push(text);
    return shared.length - 1;
  };

  const sheetFiles: Record<string, Uint8Array> = {};
  const sheetEntries = sheets.map((sheet, sheetIndex) => {
    const path = `xl/worksheets/sheet${sheetIndex + 1}.xml`;
    const rowsXml = sheet.rows
      .map((row, rowIndex) => {
        const cells = row
          .map((value, colIndex) => {
            const ref = `${colLetter(colIndex)}${rowIndex + 1}`;
            if (typeof value === "number") {
              return `<c r="${ref}"><v>${value}</v></c>`;
            }
            const text = value == null ? "" : String(value);
            return `<c r="${ref}" t="s"><v>${indexOf(text)}</v></c>`;
          })
          .join("");
        return `<row r="${rowIndex + 1}">${cells}</row>`;
      })
      .join("");

    sheetFiles[path] = strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`,
    );
    return { name: sheet.name, path, id: `rId${sheetIndex + 1}` };
  });

  const sst = shared
    .map((value) => `<si><t>${escapeXml(value)}</t></si>`)
    .join("");

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries
        .map(
          (sheet, index) =>
            `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="${sheet.id}"/>`,
        )
        .join("")}</sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetEntries
        .map(
          (sheet) =>
            `<Relationship Id="${sheet.id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheet.id.slice(3)}.xml"/>`,
        )
        .join("")}</Relationships>`,
    ),
    "xl/sharedStrings.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sst}</sst>`,
    ),
    ...sheetFiles,
  };

  const zipped = zipSync(files);
  return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength);
}

describe("parseXlsxBuffer", () => {
  it("czyta oba arkusze eksportu xStation", () => {
    const buffer = buildXlsx([
      {
        name: "CASH OPERATION HISTORY",
        rows: [
          ["Meta", "Account 1"],
          ["ID", "Type", "Time", "Comment", "Symbol", "Amount"],
          [1, "deposit", "10.01.2023 10:00:00", "Wpłata", "", 10000],
          [2, "DIVIDENT", "20.06.2023 00:00:00", "Apple", "AAPL.US", 85],
          ["", "Total", "", "", "", 10085],
        ],
      },
      {
        name: "CLOSED POSITION HISTORY",
        rows: [
          [
            "Position",
            "Symbol",
            "Type",
            "Volume",
            "Open time",
            "Close time",
            "Commission",
            "Swap",
            "Gross P/L",
            "Comment",
          ],
          [101, "EURUSD", "buy", 0.1, "12.01.2023 10:00:00", "20.01.2023 16:00:00", 0, -1.2, 321.2, ""],
        ],
      },
    ]);

    const parsed = parseXlsxBuffer(buffer, "historia.xlsx");
    expect(parsed.cashOperations).toHaveLength(2);
    expect(parsed.cashOperations[0].kind).toBe("deposit");
    expect(parsed.cashOperations[1].kind).toBe("dividend");
    expect(parsed.closedPositions).toHaveLength(1);
    expect(parsed.closedPositions[0].netProfit).toBeCloseTo(320, 5);
  });

  it("czyta nowy eksport xStation: UTC, IKE deposit, Stock sell i Open Positions", () => {
    const buffer = buildXlsx([
      {
        name: "Closed Positions",
        rows: [
          ["Account number", "51877991"],
          [
            "Instrument",
            "Ticker",
            "Category",
            "Type",
            "Volume",
            "Open Price",
            "Open Time (UTC)",
            "Close Price",
            "Close Time (UTC)",
            "Product",
            "Profit/Loss",
            "Gross Profit",
            "Purchase Value",
            "Sale Value",
            "Commission",
            "Swap",
            "Rollover",
            "Position ID",
            "Comment",
          ],
          [
            "Acme",
            "ACM.PL",
            "STOCK",
            "BUY",
            2,
            23.5,
            44927,
            31.34,
            44980,
            "IKE",
            15.68,
            15.68,
            47,
            62.68,
            0,
            0,
            0,
            2582655708,
            "",
          ],
          ["Profit/loss", "", "", "", "", "", "", "", "", "", 15.68],
        ],
      },
      {
        name: "Cash Operations",
        rows: [
          ["Account number", "51877991"],
          [
            "Type",
            "Instrument",
            "Ticker",
            "Category",
            "Time",
            "Amount",
            "ID",
            "Comment",
            "Product",
            "Position ID",
          ],
          ["IKE deposit", "", "", "", 44900, 2000, "1", "Transfer in", "IKE", ""],
          ["Stock purchase", "Acme", "ACM.PL", "STOCK", 44910, -47, "2", "OPEN BUY", "IKE", ""],
          ["Stock sell", "Acme", "ACM.PL", "STOCK", 44980, 62.68, "3", "CLOSE BUY", "IKE", ""],
          [
            "Dividend from foreign company on PL market",
            "Foo",
            "FOO.PL",
            "STOCK",
            44950,
            10,
            "4",
            "Div",
            "IKE",
            "",
          ],
          [
            "Tax from dividend from foreign company on PL market",
            "Foo",
            "FOO.PL",
            "STOCK",
            44950,
            -1.5,
            "5",
            "Tax",
            "IKE",
            "",
          ],
          ["IKE tax", "", "", "", 44960, -9, "6", "Tax", "IKE", ""],
          ["Close trade", "GOLD", "GOLD", "CFD", 44970, -3, "7", "Profit of position #9", "IKE", "9"],
          ["Free funds interest", "", "", "", 44990, 0.24, "8", "Interest", "IKE", ""],
          ["Total", "", "", "", "", 2012.42, "", "", "", ""],
        ],
      },
      {
        name: "Open Positions",
        rows: [
          ["Account number", "51877991"],
          ["Product", "Metric", "Amount", "Currency"],
          ["IKE", "Value", 3784.13, ""],
          ["IKE", "Profit", 1104.39, ""],
          ["Note", "Summary values and open positions are shown as of the report generation time"],
          [
            "Product",
            "Instrument/Position",
            "Ticker",
            "Category",
            "Type",
            "Volume",
            "Value",
            "Current price",
            "Open price",
            "Open time (UTC)",
            "Net Profit",
            "Gross Profit",
          ],
          ["IKE", "Acme", "ACM.PL", "STOCK", "BUY", 9, 1210.5, 134.5, 21.08, 44900, 538, 1020],
        ],
      },
    ]);

    const parsed = parseXlsxBuffer(buffer, "IKE_51877991_2026.xlsx");
    expect(parsed.accountKind).toBe("ike");
    expect(parsed.recognized).toBe(true);
    expect(parsed.openProfit).toBeCloseTo(1104.39, 5);
    expect(parsed.openPositionsValue).toBeCloseTo(3784.13, 5);
    expect(parsed.openPositions).toHaveLength(1);
    expect(parsed.openPositions?.[0]?.symbol).toBe("ACM.PL");
    expect(parsed.openPositions?.[0]?.netProfit).toBeCloseTo(538, 5);
    expect(parsed.closedPositions).toHaveLength(1);
    expect(parsed.closedPositions[0]?.symbol).toBe("Acme");
    expect(parsed.closedPositions[0]?.netProfit).toBeCloseTo(15.68, 5);
    expect(parsed.cashOperations.map((row) => row.kind)).toEqual([
      "transfer",
      "purchase",
      "sale",
      "dividend",
      "withholding_tax",
      "withholding_tax",
      "profit_loss",
      "interest",
    ]);
  });
});
