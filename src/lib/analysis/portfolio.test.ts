import { describe, expect, it } from "vitest";
import { analyzePortfolio } from "./portfolio";
import { sampleXtbHistory } from "../xtb/sample";

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
