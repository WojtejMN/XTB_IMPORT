import { describe, expect, it } from "vitest";
import {
  buildDailySeries,
  buildPortfolioDailySeries,
  sumDailySeries,
  toChartPoints,
  type DailySeriesPoint,
} from "./daily-series";
import { groupPricesByTicker } from "./market-value";
import type { CashOperation, ClosedPosition, ParsedXtbFile } from "../xtb/types";

function cash(partial: Partial<CashOperation> & Pick<CashOperation, "kind" | "time" | "amount">): CashOperation {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    rawType: partial.rawType ?? partial.kind,
    comment: partial.comment ?? "",
    symbol: partial.symbol ?? "",
    accountKind: partial.accountKind ?? "standard",
    ...partial,
  };
}

function closed(partial: Partial<ClosedPosition> & Pick<ClosedPosition, "symbol" | "closeTime" | "netProfit">): ClosedPosition {
  return {
    position: partial.position ?? "1",
    type: partial.type ?? "BUY",
    volume: partial.volume ?? null,
    openTime: partial.openTime ?? null,
    commission: partial.commission ?? 0,
    swap: partial.swap ?? 0,
    rollover: partial.rollover ?? 0,
    grossProfit: partial.grossProfit ?? partial.netProfit,
    comment: partial.comment ?? "",
    accountKind: partial.accountKind ?? "standard",
    ...partial,
  };
}

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

function at(series: DailySeriesPoint[], date: string): DailySeriesPoint {
  const point = series.find((entry) => entry.date === date);
  if (!point) {
    throw new Error(`Brak punktu dla ${date}`);
  }
  return point;
}

describe("buildDailySeries", () => {
  it("dopuszcza ujemny kapitał netto po wypłacie zysku", () => {
    const parsed = file({
      cashOperations: [
        cash({ kind: "deposit", time: new Date("2024-01-02T10:00:00Z"), amount: 1000 }),
        cash({ kind: "dividend", time: new Date("2024-01-03T10:00:00Z"), amount: 1438.61, symbol: "CDR.PL" }),
        cash({ kind: "withdrawal", time: new Date("2024-01-04T10:00:00Z"), amount: 2438.61 }),
      ],
    });

    const series = buildDailySeries(parsed);
    const last = series[series.length - 1]!;

    expect(last.date).toBe("2024-01-04");
    expect(last.netCapital).toBeCloseTo(-1438.61, 5);
    expect(last.portfolioValue).toBeCloseTo(0, 5);
    expect(last.totalProfit).toBeCloseTo(1438.61, 5);
  });

  it("liczy wartość jako gotówka + ilość × cena zamknięcia", () => {
    const parsed = file({
      cashOperations: [
        cash({ kind: "deposit", time: new Date("2024-01-02T09:00:00Z"), amount: 5000 }),
        cash({
          kind: "purchase",
          time: new Date("2024-01-02T10:00:00Z"),
          amount: -1000,
          symbol: "CDR.PL",
        }),
      ],
      openPositions: [
        {
          symbol: "CDR.PL",
          netProfit: 200,
          volume: 10,
          openPrice: 100,
          openTime: new Date("2024-01-02T10:00:00Z"),
          accountKind: "standard",
        },
      ],
    });

    const prices = groupPricesByTicker([
      { ticker: "CDR.PL", date: "2024-01-02", close_price: 100, currency: "PLN" },
      { ticker: "CDR.PL", date: "2024-01-03", close_price: 110, currency: "PLN" },
      { ticker: "CDR.PL", date: "2024-01-04", close_price: 120, currency: "PLN" },
    ]);

    const series = buildDailySeries(parsed, prices);

    // 4000 gotówki + 10 × 110
    expect(at(series, "2024-01-03").portfolioValue).toBeCloseTo(5100, 5);
    expect(at(series, "2024-01-04").portfolioValue).toBeCloseTo(5200, 5);
    expect(at(series, "2024-01-04").netCapital).toBeCloseTo(5000, 5);
    expect(at(series, "2024-01-04").totalProfit).toBeCloseTo(200, 5);
  });

  it("zeruje wartość, gdy nie ma gotówki ani akcji", () => {
    const parsed = file({
      cashOperations: [
        cash({ kind: "deposit", time: new Date("2024-02-01T10:00:00Z"), amount: 1000 }),
        cash({ kind: "purchase", time: new Date("2024-02-02T10:00:00Z"), amount: -1000, symbol: "CDR.PL" }),
        cash({ kind: "sale", time: new Date("2024-02-05T10:00:00Z"), amount: 1200, symbol: "CDR.PL" }),
        cash({ kind: "withdrawal", time: new Date("2024-02-06T10:00:00Z"), amount: 1200 }),
      ],
      closedPositions: [
        closed({
          symbol: "CDR.PL",
          volume: 10,
          openPrice: 100,
          openTime: new Date("2024-02-02T10:00:00Z"),
          closeTime: new Date("2024-02-05T10:00:00Z"),
          netProfit: 200,
        }),
      ],
    });

    const series = buildDailySeries(parsed);
    const last = series[series.length - 1]!;

    expect(last.portfolioValue).toBeCloseTo(0, 5);
    expect(last.netCapital).toBeCloseTo(-200, 5);
    expect(last.totalProfit).toBeCloseTo(200, 5);
  });

  it("wycenia pozycję po koszcie, gdy brak notowań", () => {
    const parsed = file({
      cashOperations: [
        cash({ kind: "deposit", time: new Date("2024-03-01T10:00:00Z"), amount: 3000 }),
        cash({ kind: "purchase", time: new Date("2024-03-04T10:00:00Z"), amount: -2000, symbol: "SXRV.DE" }),
      ],
      openPositions: [
        {
          symbol: "SXRV.DE",
          netProfit: 0,
          volume: 4,
          openPrice: 500,
          openTime: new Date("2024-03-04T10:00:00Z"),
          accountKind: "standard",
        },
      ],
    });

    const series = buildDailySeries(parsed);
    const last = series[series.length - 1]!;

    // 1000 gotówki + 4 × 500 kosztu
    expect(last.portfolioValue).toBeCloseTo(3000, 5);
    expect(last.totalProfit).toBeCloseTo(0, 5);
  });
});

describe("sumDailySeries", () => {
  it("sumuje wartości per dzień, a zysk liczy z sum", () => {
    const ike: DailySeriesPoint[] = [
      {
        date: "2024-01-01",
        portfolioValue: 1000,
        netCapital: 900,
        totalProfit: 100,
        depositDelta: 900,
        withdrawalDelta: 0,
      },
      {
        date: "2024-01-02",
        portfolioValue: 1100,
        netCapital: 900,
        totalProfit: 200,
        depositDelta: 0,
        withdrawalDelta: 0,
      },
    ];
    const standard: DailySeriesPoint[] = [
      {
        date: "2024-01-02",
        portfolioValue: 0,
        netCapital: -1438.61,
        totalProfit: 1438.61,
        depositDelta: 0,
        withdrawalDelta: 1438.61,
      },
    ];

    const total = sumDailySeries([ike, standard]);

    expect(total).toHaveLength(2);
    expect(at(total, "2024-01-01").portfolioValue).toBeCloseTo(1000, 5);
    expect(at(total, "2024-01-02").portfolioValue).toBeCloseTo(1100, 5);
    expect(at(total, "2024-01-02").netCapital).toBeCloseTo(-538.61, 5);
    expect(at(total, "2024-01-02").totalProfit).toBeCloseTo(1638.61, 5);
    expect(at(total, "2024-01-02").withdrawalDelta).toBeCloseTo(1438.61, 5);
  });
});

describe("buildPortfolioDailySeries", () => {
  it("liczy konta osobno i sumę zaznaczonych", () => {
    const standard = file({
      accountKind: "standard",
      sourceName: "PLN.xlsx",
      cashOperations: [
        cash({ kind: "deposit", time: new Date("2024-01-02T10:00:00Z"), amount: 1000 }),
      ],
    });
    const ike = file({
      accountKind: "ike",
      sourceName: "IKE.xlsx",
      cashOperations: [
        cash({
          kind: "deposit",
          time: new Date("2024-01-02T10:00:00Z"),
          amount: 500,
          accountKind: "ike",
        }),
        cash({
          kind: "dividend",
          time: new Date("2024-01-03T10:00:00Z"),
          amount: 40,
          symbol: "CDR.PL",
          accountKind: "ike",
        }),
      ],
    });

    const { total, perAccount } = buildPortfolioDailySeries(
      [standard, ike],
      ["standard", "ike"],
    );

    expect(perAccount.standard).toBeTruthy();
    expect(perAccount.ike).toBeTruthy();
    expect(at(perAccount.ike!, "2024-01-03").totalProfit).toBeCloseTo(40, 5);
    expect(at(total, "2024-01-03").portfolioValue).toBeCloseTo(1540, 5);
    expect(at(total, "2024-01-03").netCapital).toBeCloseTo(1500, 5);
    expect(at(total, "2024-01-03").totalProfit).toBeCloseTo(40, 5);
  });
});

describe("toChartPoints", () => {
  it("przenosi ujemny kapitał bez ucinania", () => {
    const points = toChartPoints([
      {
        date: "2024-01-04",
        portfolioValue: 0,
        netCapital: -1438.61,
        totalProfit: 1438.61,
        depositDelta: 0,
        withdrawalDelta: 2438.61,
      },
    ]);

    expect(points[0]!.investedCapital).toBeCloseTo(-1438.61, 5);
    expect(points[0]!.netCapital).toBeCloseTo(-1438.61, 5);
    expect(points[0]!.cumulativeGain).toBeCloseTo(1438.61, 5);
    expect(points[0]!.label).toBe("04.01.2024");
  });
});
