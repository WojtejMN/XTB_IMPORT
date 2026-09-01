import { describe, expect, it } from "vitest";
import { aggregateSymbolProfits, normalizeSymbolKey } from "./symbol-profit";
import type { ParsedXtbFile } from "./types";

function file(overrides: Partial<ParsedXtbFile>): ParsedXtbFile {
  return {
    sourceName: "test.xlsx",
    accountKind: "standard",
    warnings: [],
    cashOperations: [],
    closedPositions: [],
    ...overrides,
  };
}

describe("normalizeSymbolKey", () => {
  it("łączy warianty tego samego tickera", () => {
    expect(normalizeSymbolKey("ASBIS.PL")).toBe("ASBIS");
    expect(normalizeSymbolKey("asbis")).toBe("ASBIS");
  });
});

describe("aggregateSymbolProfits", () => {
  it("sumuje wiele zamkniętych pozycji tego samego symbolu", () => {
    const parsed = file({
      closedPositions: [
        {
          position: "1",
          symbol: "EURUSD",
          type: "BUY",
          volume: 0.1,
          openTime: new Date("2024-01-01"),
          closeTime: new Date("2024-02-01"),
          commission: 0,
          swap: 0,
          rollover: 0,
          grossProfit: 100,
          netProfit: 100,
          comment: "",
          accountKind: "standard",
        },
        {
          position: "2",
          symbol: "EURUSD",
          type: "BUY",
          volume: 0.1,
          openTime: new Date("2024-03-01"),
          closeTime: new Date("2024-04-01"),
          commission: 0,
          swap: 0,
          rollover: 0,
          grossProfit: 50,
          netProfit: 50,
          comment: "",
          accountKind: "standard",
        },
      ],
    });

    const result = aggregateSymbolProfits(parsed);
    expect(result).toHaveLength(1);
    expect(result[0]?.profit).toBe(150);
    expect(result[0]?.trades).toBe(2);
  });

  it("sumuje kupna, sprzedaże i dywidendy akcji pod jednym symbolem", () => {
    const parsed = file({
      cashOperations: [
        {
          id: "1",
          kind: "purchase",
          rawType: "Stock purchase",
          time: new Date("2024-01-01"),
          comment: "",
          symbol: "ASBIS.PL",
          amount: -1000,
          accountKind: "standard",
        },
        {
          id: "2",
          kind: "sale",
          rawType: "Stock sell",
          time: new Date("2024-06-01"),
          comment: "",
          symbol: "ASBIS.PL",
          amount: 1300,
          accountKind: "standard",
        },
        {
          id: "3",
          kind: "purchase",
          rawType: "Stock purchase",
          time: new Date("2024-08-01"),
          comment: "",
          symbol: "ASBIS",
          amount: -500,
          accountKind: "standard",
        },
        {
          id: "4",
          kind: "sale",
          rawType: "Stock sell",
          time: new Date("2024-10-01"),
          comment: "",
          symbol: "ASBIS.PL",
          amount: 700,
          accountKind: "standard",
        },
        {
          id: "5",
          kind: "dividend",
          rawType: "DIVIDENT",
          time: new Date("2024-11-01"),
          comment: "",
          symbol: "ASBIS.PL",
          amount: 40,
          accountKind: "standard",
        },
        {
          id: "6",
          kind: "withholding_tax",
          rawType: "Withholding Tax",
          time: new Date("2024-11-01"),
          comment: "",
          symbol: "ASBIS.PL",
          amount: -6,
          accountKind: "standard",
        },
      ],
    });

    const result = aggregateSymbolProfits(parsed);
    expect(result).toHaveLength(1);
    expect(result[0]?.profit).toBeCloseTo(-1000 + 1300 - 500 + 700 + 40 - 6, 5);
    expect(result[0]?.trades).toBe(2);
  });

  it("dolicza zysk z otwartych pozycji", () => {
    const parsed = file({
      cashOperations: [
        {
          id: "1",
          kind: "purchase",
          rawType: "Stock purchase",
          time: new Date("2024-01-01"),
          comment: "",
          symbol: "ACM.PL",
          amount: -1000,
          accountKind: "ike",
        },
      ],
      openPositions: [
        {
          symbol: "ACM.PL",
          netProfit: 538,
          grossProfit: 1020,
          value: 1210.5,
          accountKind: "ike",
        },
      ],
    });

    const result = aggregateSymbolProfits(parsed);
    expect(result).toHaveLength(1);
    // Wartość 1210,5 − koszt 1000 = 210,5 (nie podwójne liczenie kupna).
    expect(result[0]?.profit).toBeCloseTo(210.5, 5);
    expect(result[0]?.trades).toBe(0);
    expect(result[0]?.openPositions).toBe(1);
  });

  it("łączy sprzedaż na jednym koncie z trzymaniem na innym", () => {
    const parsed = file({
      cashOperations: [
        {
          id: "1",
          kind: "purchase",
          rawType: "Stock purchase",
          time: new Date("2024-01-01"),
          comment: "",
          symbol: "ASBIS.PL",
          amount: -5000,
          accountKind: "ike",
        },
        {
          id: "2",
          kind: "purchase",
          rawType: "Stock purchase",
          time: new Date("2024-03-01"),
          comment: "",
          symbol: "ASBIS.PL",
          amount: -2000,
          accountKind: "standard",
        },
        {
          id: "3",
          kind: "sale",
          rawType: "Stock sell",
          time: new Date("2024-06-01"),
          comment: "",
          symbol: "ASBIS.PL",
          amount: 2500,
          accountKind: "standard",
        },
      ],
      openPositions: [
        {
          symbol: "ASBIS.PL",
          netProfit: 538,
          value: 5538,
          accountKind: "ike",
        },
      ],
    });

    const result = aggregateSymbolProfits(parsed);
    expect(result).toHaveLength(1);
    // Zrealizowany +500 (PLN) + niezrealizowany +538 (IKE) = +1038
    expect(result[0]?.profit).toBeCloseTo(1038, 5);
    expect(result[0]?.trades).toBe(1);
    expect(result[0]?.openPositions).toBe(1);
  });
});
