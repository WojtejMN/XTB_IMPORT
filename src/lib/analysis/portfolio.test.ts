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
    expect(report.totalReturn).toBeCloseTo(4_104.65 / 27_000, 8);
    expect(report.annualReturn).not.toBeNull();
    expect(report.chart.length).toBeGreaterThan(3);
    expect(report.chart[0]?.deposits).toBe(0);
    expect(report.chart.at(-1)?.deposits).toBe(27_000);
    expect(report.chart.at(-1)?.profit).toBeCloseTo(4_104.65, 5);
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
});
