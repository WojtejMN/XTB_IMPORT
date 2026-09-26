import { describe, expect, it } from "vitest";
import {
  accountBreakdownFromSeries,
  buildPortfolioDailySeries,
  summarizeDailySeries,
  toChartPoints,
} from "./daily-series";
import { sampleAccounts } from "../xtb/sample";

const KINDS = ["standard", "ike", "ikze"] as const;

describe("przykładowe dane: kafelki vs wykres", () => {
  const files = sampleAccounts();
  const { total, perAccount } = buildPortfolioDailySeries(files, [...KINDS]);
  const totals = summarizeDailySeries(total)!;
  const breakdown = accountBreakdownFromSeries(perAccount);
  const lastPoint = toChartPoints(total).at(-1)!;

  it("kafelek hero pokazuje dokładnie ostatni punkt wykresu", () => {
    expect(totals.portfolioValue).toBeCloseTo(lastPoint.portfolioValue, 5);
    expect(totals.netCapital).toBeCloseTo(lastPoint.netCapital, 5);
    expect(totals.totalProfit).toBeCloseTo(lastPoint.cumulativeGain, 5);

    expect(totals.portfolioValue).toBeCloseTo(49_912.65, 2);
    expect(totals.netCapital).toBeCloseTo(45_000, 2);
    expect(totals.totalProfit).toBeCloseTo(4_912.65, 2);
  });

  it("suma kont zgadza się z kafelkiem łącznym", () => {
    const valueSum = breakdown.reduce((sum, entry) => sum + entry.portfolioValue, 0);
    const profitSum = breakdown.reduce((sum, entry) => sum + entry.totalProfit, 0);
    expect(valueSum).toBeCloseTo(totals.portfolioValue, 5);
    expect(profitSum).toBeCloseTo(totals.totalProfit, 5);
  });

  it("zysk to wartość minus kapitał netto", () => {
    expect(totals.totalProfit).toBeCloseTo(totals.portfolioValue - totals.netCapital, 5);
    expect(totals.netCapital).toBeCloseTo(totals.totalDeposits - totals.totalWithdrawals, 5);
  });
});
