import { describe, expect, it } from "vitest";
import { classifyCashType, isIgnorableRow } from "./classify";
import { parseCsvText } from "./parse-table";
import { SAMPLE_CASH_CSV, SAMPLE_TRADES_CSV } from "./sample";
import { detectAccountKind } from "./account";

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
    expect(classifyCashType("Free funds interest")).toBe("interest");
    expect(classifyCashType("Free funds interest tax")).toBe("interest_tax");
    expect(classifyCashType("Dividend from foreign company on PL market")).toBe("dividend");
    expect(classifyCashType("Tax from dividend from foreign company on PL market")).toBe(
      "withholding_tax",
    );
    expect(classifyCashType("IKE tax")).toBe("withholding_tax");
  });

  it("rozpoznaje transfery, kupna, sprzedaży i splity", () => {
    expect(classifyCashType("transfer")).toBe("transfer");
    expect(classifyCashType("IKE deposit")).toBe("transfer");
    expect(classifyCashType("IKE return partial")).toBe("transfer");
    expect(classifyCashType("Subaccount transfer")).toBe("transfer");
    expect(classifyCashType("Stocks/ETF purchase")).toBe("purchase");
    expect(classifyCashType("Stock purchase")).toBe("purchase");
    expect(classifyCashType("Stocks/ETF sale")).toBe("sale");
    expect(classifyCashType("Stock sell")).toBe("sale");
    expect(classifyCashType("Kupno akcji")).toBe("purchase");
    expect(classifyCashType("Sprzedaż akcji")).toBe("sale");
    expect(classifyCashType("Stock split")).toBe("stock_split");
    expect(classifyCashType("Równoważenie akcji")).toBe("stock_split");
    expect(classifyCashType("spin off")).toBe("dividend");
    expect(classifyCashType("Close trade")).toBe("profit_loss");
  });

  it("pomija wiersz Total", () => {
    expect(isIgnorableRow("Total")).toBe(true);
    expect(isIgnorableRow("SUMA")).toBe(true);
  });
});

describe("detectAccountKind", () => {
  it("odróżnia IKZE od IKE", () => {
    expect(detectAccountKind("historia-ikze.xlsx")).toBe("ikze");
    expect(detectAccountKind("XTB_IKE_2024.csv")).toBe("ike");
    expect(detectAccountKind("cash-operations.xlsx")).toBe("standard");
  });

  it("nie myli zwykłego rachunku PLN z IKE tylko dlatego, że jest transfer IKE deposit", () => {
    expect(
      detectAccountKind(
        "PLN_50746360_2006-01-01.xlsx",
        "Type Instrument Time Amount IKE deposit Transfer out operation",
      ),
    ).toBe("standard");
    expect(detectAccountKind("IKE_51877991.xlsx", "Stock purchase")).toBe("ike");
    expect(detectAccountKind("IKZE_52516643.xlsx")).toBe("ikze");
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

  it("czyta przykładowe operacje kasowe wraz z kupnem i transferem", () => {
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
      "purchase",
      "sale",
      "stock_split",
      "transfer",
    ]);
  });

  it("oznacza plik IKE po nazwie", () => {
    const parsed = parseCsvText(SAMPLE_CASH_CSV, "historia-ike.csv");
    expect(parsed.accountKind).toBe("ike");
    expect(parsed.cashOperations[0]?.accountKind).toBe("ike");
  });
});
