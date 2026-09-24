import { describe, expect, it } from "vitest";
import { collectTickerStartDates } from "./ticker-requests";
import type { ParsedXtbFile } from "../xtb/types";

function file(overrides: Partial<ParsedXtbFile>): ParsedXtbFile {
  return {
    sourceName: "t.xlsx",
    accountKind: "standard",
    warnings: [],
    cashOperations: [],
    closedPositions: [],
    ...overrides,
  };
}

describe("collectTickerStartDates", () => {
  it("bierze najwcześniejszą datę per ticker", () => {
    const parsed = file({
      cashOperations: [
        {
          id: "1",
          kind: "purchase",
          rawType: "Stock purchase",
          time: new Date("2024-06-01T10:00:00Z"),
          comment: "",
          symbol: "AAPL.US",
          amount: -100,
          accountKind: "standard",
        },
        {
          id: "2",
          kind: "purchase",
          rawType: "Stock purchase",
          time: new Date("2024-01-10T10:00:00Z"),
          comment: "",
          symbol: "aapl.us",
          amount: -50,
          accountKind: "standard",
        },
        {
          id: "3",
          kind: "deposit",
          rawType: "Deposit",
          time: new Date("2023-01-01T10:00:00Z"),
          comment: "",
          symbol: "",
          amount: 1000,
          accountKind: "standard",
        },
      ],
      closedPositions: [
        {
          position: "1",
          symbol: "CDR.PL",
          type: "BUY",
          volume: 1,
          openTime: new Date("2023-05-18T10:00:00Z"),
          closeTime: new Date("2023-06-01T10:00:00Z"),
          commission: 0,
          swap: 0,
          rollover: 0,
          grossProfit: 10,
          netProfit: 10,
          comment: "",
          accountKind: "standard",
        },
      ],
    });

    expect(collectTickerStartDates(parsed)).toEqual([
      { xtbTicker: "AAPL.US", startDate: "2024-01-10" },
      { xtbTicker: "CDR.PL", startDate: "2023-05-18" },
    ]);
  });
});
