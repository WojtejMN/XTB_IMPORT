import { describe, expect, it } from "vitest";
import { aggregateChartPoints, clampChartRange, formatBucketLabel } from "./chart-series";
import type { ChartPoint } from "../xtb/types";

function point(
  time: string,
  netCapital: number,
  portfolioValue: number,
  depositDelta = 0,
  withdrawalDelta = 0,
): ChartPoint {
  const date = new Date(time);
  return {
    time: date.getTime(),
    label: date.toISOString(),
    netCapital,
    portfolioValue,
    investedCapital: netCapital,
    cumulativeGain: portfolioValue - netCapital,
    depositDelta,
    withdrawalDelta,
  };
}

describe("aggregateChartPoints", () => {
  const series: ChartPoint[] = [
    point("2024-01-10T10:00:00", 1000, 1000),
    point("2024-01-10T18:00:00", 2000, 2050),
    point("2024-02-01T09:00:00", 3000, 3100),
    point("2024-03-15T12:00:00", 4000, 4200),
    point("2025-01-05T08:00:00", 5000, 5400),
  ];

  it("scala do miesięcy — ostatnia wartość w miesiącu", () => {
    const monthly = aggregateChartPoints(series, "month");
    expect(monthly).toHaveLength(4);
    expect(monthly[0]?.netCapital).toBe(2000);
    expect(monthly[0]?.label).toBe("sty 2024");
    expect(monthly[1]?.netCapital).toBe(3000);
    expect(monthly[2]?.netCapital).toBe(4000);
    expect(monthly[3]?.netCapital).toBe(5000);
  });

  it("scala do lat", () => {
    const yearly = aggregateChartPoints(series, "year");
    expect(yearly).toHaveLength(2);
    expect(yearly[0]?.portfolioValue).toBe(4200);
    expect(yearly[1]?.portfolioValue).toBe(5400);
  });

  it("dla dni zostawia ostatni punkt danego dnia", () => {
    const daily = aggregateChartPoints(series, "day");
    expect(daily).toHaveLength(4);
    expect(daily[0]?.netCapital).toBe(2000);
  });
});

describe("formatBucketLabel", () => {
  it("formatuje miesiąc po polsku", () => {
    expect(formatBucketLabel(new Date("2024-06-01").getTime(), "month")).toBe("cze 2024");
  });
});

describe("clampChartRange", () => {
  it("ogranicza indeksy do zakresu danych", () => {
    expect(clampChartRange(10, -2, 99)).toEqual({ startIndex: 0, endIndex: 9 });
    expect(clampChartRange(10, 8, 3)).toEqual({ startIndex: 8, endIndex: 8 });
  });
});
