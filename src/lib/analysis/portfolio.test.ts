import { describe, expect, it } from "vitest";
import { analyzePortfolio } from "./portfolio";
import { mergeParsedFiles } from "../xtb/merge";
import { sampleAccounts, sampleXtbHistory } from "../xtb/sample";

describe("analyzePortfolio", () => {
  it("liczy sumę wpłat, zysk i stopy zwrotu na przykładowej historii", () => {
    const report = analyzePortfolio(sampleXtbHistory());

    expect(report.totalDeposits).toBe(27_000);
    expect(report.totalWithdrawals).toBe(2_000);
    expect(report.netDeposits).toBe(25_000);
    expect(report.totalProfit).toBeCloseTo(4_104.65, 5);
    expect(report.portfolioValue).toBeCloseTo(25_000 + 4_104.65, 5);
    expect(report.totalReturn).toBeCloseTo(4_104.65 / 27_000, 8);
    expect(report.annualReturn).not.toBeNull();
    expect(report.chart.length).toBeGreaterThan(3);
    expect(report.chart[0]?.netCapital).toBe(0);
    expect(report.chart.at(-1)?.netCapital).toBe(25_000);
    expect(report.chart.at(-1)?.equity).toBeCloseTo(25_000 + 4_104.65, 5);
  });

  it("nie wlicza kupna, sprzedaży i splitów do wpłat ani zysku", () => {
    const merged = mergeParsedFiles(sampleAccounts(), ["ike"]);
    const report = analyzePortfolio(merged, { treatTransfersAsExternal: true });
    expect(report.totalDeposits).toBe(15_000);
    expect(report.totalProfit).toBeCloseTo(153, 5);
    expect(report.kindCounts.purchase).toBe(1);
    expect(report.kindCounts.sale).toBe(1);
    expect(report.kindCounts.stock_split).toBe(1);
  });

  it("w widoku wszystkich kont pomija transfery wewnętrzne", () => {
    const merged = mergeParsedFiles(sampleAccounts(), ["standard", "ike", "ikze"]);
    const report = analyzePortfolio(merged, { treatTransfersAsExternal: false });
    expect(report.totalDeposits).toBe(47_000);
    expect(report.totalWithdrawals).toBe(2_000);
    expect(report.totalProfit).toBeCloseTo(4_104.65 + 153 + 55, 5);
  });

  it("w widoku IKZE liczy transfer przychodzący jak wpłatę", () => {
    const merged = mergeParsedFiles(sampleAccounts(), ["ikze"]);
    const report = analyzePortfolio(merged, { treatTransfersAsExternal: true });
    expect(report.totalDeposits).toBe(8_000);
    expect(report.totalProfit).toBe(55);
  });

  it("uwzględnia aktualną wartość konta w zysku i XIRR", () => {
    const withoutValue = analyzePortfolio(sampleXtbHistory());
    const withValue = analyzePortfolio(sampleXtbHistory(), {
      currentAccountValue: 30_000,
    });

    expect(withValue.totalProfit).toBe(5_000);
    expect(withValue.unrealizedProfit).toBeCloseTo(5_000 - withoutValue.realizedProfit, 5);
    expect(withValue.annualReturn).not.toBe(withoutValue.annualReturn);
  });

  it("dolicza zysk z otwartych pozycji i nie dubluje Close trade ani subkont", () => {
    const parsed = {
      sourceName: "IKE_test.xlsx",
      accountKind: "ike" as const,
      warnings: [],
      recognized: true,
      openProfit: 1104.39,
      cashOperations: [
        {
          id: "1",
          kind: "deposit" as const,
          rawType: "Deposit",
          time: new Date("2024-01-10T10:00:00"),
          comment: "Wpłata",
          symbol: "",
          amount: 1000,
          accountKind: "ike" as const,
        },
        {
          id: "2",
          kind: "transfer" as const,
          rawType: "IKE deposit",
          time: new Date("2024-02-01T10:00:00"),
          comment: "Transfer in",
          symbol: "",
          amount: 2000,
          accountKind: "ike" as const,
        },
        {
          id: "3",
          kind: "transfer" as const,
          rawType: "Subaccount transfer",
          time: new Date("2024-03-01T10:00:00"),
          comment: "Internal",
          symbol: "",
          amount: 500,
          accountKind: "ike" as const,
        },
        {
          id: "4",
          kind: "transfer" as const,
          rawType: "Subaccount transfer",
          time: new Date("2024-03-01T10:00:00"),
          comment: "Internal",
          symbol: "",
          amount: -500,
          accountKind: "ike" as const,
        },
        {
          id: "5",
          kind: "profit_loss" as const,
          rawType: "Close trade",
          time: new Date("2024-04-01T10:00:00"),
          comment: "Profit of position #1",
          symbol: "GOLD",
          amount: -3,
          accountKind: "ike" as const,
        },
      ],
      closedPositions: [
        {
          position: "1",
          symbol: "GOLD",
          type: "BUY",
          volume: 0.1,
          openTime: new Date("2024-03-01T10:00:00"),
          closeTime: new Date("2024-04-01T10:00:00"),
          commission: 0,
          swap: 0,
          rollover: 0,
          grossProfit: 15.68,
          netProfit: 15.68,
          comment: "",
          accountKind: "ike" as const,
        },
      ],
    };

    const report = analyzePortfolio(parsed, { treatTransfersAsExternal: true });
    expect(report.totalDeposits).toBe(3000);
    expect(report.totalWithdrawals).toBe(0);
    expect(report.realizedProfit).toBeCloseTo(15.68, 5);
    expect(report.unrealizedProfit).toBeCloseTo(1104.39, 5);
    expect(report.totalProfit).toBeCloseTo(15.68 + 1104.39, 5);
    expect(report.chart.at(-1)?.netCapital).toBe(3000);
    expect(report.chart.at(-1)?.equity).toBeCloseTo(3000 + 15.68 + 1104.39, 5);
  });
});
