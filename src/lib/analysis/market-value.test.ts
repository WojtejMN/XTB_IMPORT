import { describe, expect, it } from "vitest";
import {
  buildShareLots,
  enrichChartWithMarketPrices,
  groupPricesByTicker,
  holdingsValueAt,
  priceOnOrBefore,
} from "./market-value";
import type { ChartPoint, ParsedXtbFile } from "../xtb/types";

function file(partial: Partial<ParsedXtbFile>): ParsedXtbFile {
  return {
    sourceName: "test.xlsx",
    accountKind: "standard",
    cashOperations: [],
    closedPositions: [],
    warnings: [],
    ...partial,
  };
}

describe("priceOnOrBefore", () => {
  const rows = [
    { ticker: "CDR.PL", date: "2024-01-02", close_price: 100, currency: "PLN" },
    { ticker: "CDR.PL", date: "2024-01-04", close_price: 110, currency: "PLN" },
  ];

  it("bierze cenę z danego dnia", () => {
    expect(priceOnOrBefore(rows, "2024-01-04")).toBe(110);
  });

  it("bierze ostatnią wcześniejszą przy luce", () => {
    expect(priceOnOrBefore(rows, "2024-01-03")).toBe(100);
  });

  it("zwraca null przed pierwszą ceną", () => {
    expect(priceOnOrBefore(rows, "2023-12-31")).toBeNull();
  });
});

describe("buildShareLots", () => {
  it("buduje loty z zamkniętych pozycji GPW", () => {
    const parsed = file({
      closedPositions: [
        {
          position: "1",
          symbol: "CDR.PL",
          type: "BUY",
          volume: 10,
          openTime: new Date("2024-01-02T10:00:00Z"),
          closeTime: new Date("2024-02-01T10:00:00Z"),
          commission: 0,
          swap: 0,
          rollover: 0,
          grossProfit: 100,
          netProfit: 100,
          comment: "",
          accountKind: "standard",
        },
      ],
    });

    const lots = buildShareLots(parsed, {}, {});
    expect(lots).toHaveLength(1);
    expect(lots[0]?.ticker).toBe("CDR.PL");
    expect(lots[0]?.volume).toBe(10);
  });

  it("pomija instrumenty spoza PLN", () => {
    const parsed = file({
      closedPositions: [
        {
          position: "1",
          symbol: "AAPL.US",
          type: "BUY",
          volume: 5,
          openTime: new Date("2024-01-02T10:00:00Z"),
          closeTime: new Date("2024-02-01T10:00:00Z"),
          commission: 0,
          swap: 0,
          rollover: 0,
          grossProfit: 100,
          netProfit: 100,
          comment: "",
          accountKind: "standard",
        },
      ],
    });
    expect(buildShareLots(parsed, { "AAPL.US": 180 }, {})).toEqual([]);
  });

  it("szacuje wolumen otwartej pozycji z value / cena", () => {
    const parsed = file({
      openPositions: [
        {
          symbol: "CDR.PL",
          netProfit: 200,
          value: 1200,
          accountKind: "standard",
        },
      ],
    });
    const lots = buildShareLots(parsed, { "CDR.PL": 120 }, { "CDR.PL": Date.parse("2024-01-01Z") });
    expect(lots).toHaveLength(1);
    expect(lots[0]?.volume).toBeCloseTo(10, 5);
    expect(lots[0]?.closeMs).toBeNull();
  });
});

describe("holdingsValueAt", () => {
  it("liczy MTM w trakcie trwania lota", () => {
    const lots = [
      {
        ticker: "CDR.PL",
        openMs: Date.parse("2024-01-02T10:00:00Z"),
        closeMs: Date.parse("2024-02-01T10:00:00Z"),
        volume: 10,
      },
    ];
    const prices = groupPricesByTicker([
      { ticker: "CDR.PL", date: "2024-01-02", close_price: 100, currency: "PLN" },
      { ticker: "CDR.PL", date: "2024-01-15", close_price: 110, currency: "PLN" },
    ]);

    expect(holdingsValueAt(Date.parse("2024-01-15T12:00:00Z"), lots, prices)).toBeCloseTo(1100, 5);
    expect(holdingsValueAt(Date.parse("2024-02-02T12:00:00Z"), lots, prices)).toBe(0);
  });
});

describe("enrichChartWithMarketPrices", () => {
  it("buduje wykres gotówka + MTM dla GPW", () => {
    const parsed = file({
      cashOperations: [
        {
          id: "1",
          kind: "deposit",
          rawType: "Deposit",
          time: new Date("2024-01-01T10:00:00Z"),
          comment: "",
          symbol: "",
          amount: 5000,
          accountKind: "standard",
        },
        {
          id: "2",
          kind: "purchase",
          rawType: "Stock purchase",
          time: new Date("2024-01-02T10:00:00Z"),
          comment: "",
          symbol: "CDR.PL",
          amount: -1000,
          accountKind: "standard",
        },
      ],
      closedPositions: [
        {
          position: "1",
          symbol: "CDR.PL",
          type: "BUY",
          volume: 10,
          openTime: new Date("2024-01-02T10:00:00Z"),
          closeTime: new Date("2024-03-01T10:00:00Z"),
          commission: 0,
          swap: 0,
          rollover: 0,
          grossProfit: 200,
          netProfit: 200,
          comment: "",
          accountKind: "standard",
        },
      ],
    });

    const baseChart: ChartPoint[] = [
      {
        time: Date.parse("2024-01-01T10:00:00Z"),
        label: "01.01.2024",
        netCapital: 5000,
        portfolioValue: 5000,
        investedCapital: 5000,
        cumulativeGain: 0,
        depositDelta: 5000,
        withdrawalDelta: 0,
      },
    ];

    const prices = groupPricesByTicker([
      { ticker: "CDR.PL", date: "2024-01-02", close_price: 100, currency: "PLN" },
      { ticker: "CDR.PL", date: "2024-01-15", close_price: 120, currency: "PLN" },
    ]);

    const result = enrichChartWithMarketPrices(baseChart, parsed, prices);
    expect(result.usedMarket).toBe(true);
    expect(result.pricedLots).toBe(1);

    const mid = result.chart.find((point) => point.time === Date.parse("2024-01-15T12:00:00Z"));
    expect(mid).toBeTruthy();
    // gotówka 5000 − 1000 = 4000 + 10×120 = 1200 → 5200
    expect(mid!.portfolioValue).toBeCloseTo(5200, 5);
    expect(mid!.investedCapital).toBeCloseTo(5000, 5);
  });

  it("zostawia wykres bazowy bez cen", () => {
    const baseChart: ChartPoint[] = [
      {
        time: 1,
        label: "x",
        netCapital: 100,
        portfolioValue: 100,
        investedCapital: 100,
        cumulativeGain: 0,
        depositDelta: 100,
        withdrawalDelta: 0,
      },
    ];
    const result = enrichChartWithMarketPrices(baseChart, file({}), {});
    expect(result.usedMarket).toBe(false);
    expect(result.chart).toEqual(baseChart);
  });
});
