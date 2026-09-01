import { describe, expect, it } from "vitest";
import { classifyCashType, isIgnorableRow } from "./classify";
import { parseCsvText } from "./parse-table";
import { SAMPLE_CASH_CSV, SAMPLE_TRADES_CSV } from "./sample";

describe("classifyCashType", () => {
  it("rozpoznaje wpłaty i wypłaty z sufiksami", () => {
    expect(classifyCashType("deposit")).toBe("deposit");
    expect(classifyCashType("Deposit")).toBe("deposit");
    expect(classifyCashType("Wpłata")).toBe("deposit");
    expect(classifyCashType("Withdrawal from 1844768")).toBe("withdrawal");
    expect(classifyCashType("wypłata")).toBe("withdrawal");
  });

  it("rozpoznaje dywidendy, odsetki i podatki", () => {
    expect(classifyCashType("DIVIDENT")).toBe("dividend");
    expect(classifyCashType("Withholding Tax")).toBe("withholding_tax");
    expect(classifyCashType("Free-funds Interest 2024-01")).toBe("interest");
    expect(classifyCashType("Free-funds Interest Tax 2024-01")).toBe("interest_tax");
  });

  it("pomija wiersz Total", () => {
    expect(isIgnorableRow("Total")).toBe(true);
    expect(isIgnorableRow("SUMA")).toBe(true);
  });
});

describe("parseCsvText", () => {
  it("pomija metadane i wiersz Total w eksporcie kasowym XTB", () => {
    const csv = `Account history
Client: 123
ID;Type;Time;Comment;Symbol;Amount;;;;
1;deposit;10.01.2023 10:00:00;Wpłata;;10 000,00;;;;
2;Withdrawal from 99;11.02.2023 12:00:00;Wypłata;;-2.000,50;;;;
Total;;;;;7999,50;;;;
`;
    const parsed = parseCsvText(csv, "cash.csv");
    expect(parsed.cashOperations).toHaveLength(2);
    expect(parsed.cashOperations[0]).toMatchObject({
      kind: "deposit",
      amount: 10_000,
    });
    expect(parsed.cashOperations[1]).toMatchObject({
      kind: "withdrawal",
      amount: -2000.5,
    });
    expect(parsed.cashOperations[0].time.getFullYear()).toBe(2023);
    expect(parsed.cashOperations[0].time.getMonth()).toBe(0);
    expect(parsed.cashOperations[0].time.getDate()).toBe(10);
  });

  it("czyta zamknięte pozycje i liczy net P/L", () => {
    const parsed = parseCsvText(SAMPLE_TRADES_CSV, "trades.csv");
    expect(parsed.closedPositions).toHaveLength(5);
    const first = parsed.closedPositions[0];
    expect(first.symbol).toBe("EURUSD");
    expect(first.netProfit).toBeCloseTo(320, 5);
    expect(first.grossProfit).toBeCloseTo(321.2, 5);
  });

  it("czyta przykładowe operacje kasowe", () => {
    const parsed = parseCsvText(SAMPLE_CASH_CSV, "cash.csv");
    expect(parsed.cashOperations.map((row) => row.kind)).toEqual([
      "deposit",
      "deposit",
      "dividend",
      "withholding_tax",
      "deposit",
      "interest",
      "withdrawal",
      "deposit",
    ]);
  });
});
