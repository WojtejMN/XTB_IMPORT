import { duplicatesClosedPositionPnl, isSubaccountTransfer } from "../xtb/classify";
import type { AssetPriceRow } from "../prices/supabase";
import { isPlnMarketTicker } from "../prices/yahoo-ticker";
import type { CashOperation, ChartPoint, ParsedXtbFile } from "../xtb/types";
import { findInternalTransferKeys, isExternalTransfer } from "./transfers";

export type PricesByTicker = Record<string, AssetPriceRow[]>;

export type ShareLot = {
  ticker: string;
  openMs: number;
  /** null = pozycja nadal otwarta */
  closeMs: number | null;
  volume: number;
};

function toIsoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function formatChartLabel(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Cena zamknięcia z dnia `isoDay` lub ostatnia wcześniejsza. */
export function priceOnOrBefore(
  rows: AssetPriceRow[] | undefined,
  isoDay: string,
): number | null {
  if (!rows || rows.length === 0) {
    return null;
  }
  let best: number | null = null;
  for (const row of rows) {
    if (row.date <= isoDay) {
      best = row.close_price;
    } else {
      break;
    }
  }
  return best;
}

/**
 * Loty akcji GPW do wyceny MTM.
 * Zamknięte: volume z Closed Positions.
 * Otwarte: volume z Open Positions (albo value / ostatnia cena).
 */
export function buildShareLots(
  parsed: ParsedXtbFile,
  latestPrices: Record<string, number>,
  openFromMs: Record<string, number>,
): ShareLot[] {
  const lots: ShareLot[] = [];

  for (const position of parsed.closedPositions) {
    const ticker = position.symbol.trim().toUpperCase();
    if (!ticker || !isPlnMarketTicker(ticker) || position.volume == null || position.volume <= 0) {
      continue;
    }
    const openMs = (position.openTime ?? position.closeTime).getTime();
    lots.push({
      ticker,
      openMs,
      closeMs: position.closeTime.getTime(),
      volume: position.volume,
    });
  }

  for (const position of parsed.openPositions ?? []) {
    const ticker = position.symbol.trim().toUpperCase();
    if (!ticker || !isPlnMarketTicker(ticker)) {
      continue;
    }

    let volume = position.volume != null && position.volume > 0 ? position.volume : null;
    if (volume == null && position.value != null && position.value > 0) {
      const lastPrice = latestPrices[ticker];
      if (lastPrice != null && lastPrice > 0) {
        volume = position.value / lastPrice;
      }
    }
    if (volume == null || !Number.isFinite(volume) || volume <= 0) {
      continue;
    }

    const openMs =
      position.openTime?.getTime() ??
      openFromMs[ticker] ??
      Date.now();

    lots.push({
      ticker,
      openMs,
      closeMs: null,
      volume,
    });
  }

  return lots;
}

/** Najwcześniejsza aktywność per ticker (zakup / otwarcie pozycji). */
export function earliestActivityByTicker(parsed: ParsedXtbFile): Record<string, number> {
  const map: Record<string, number> = {};

  function bump(symbol: string, time: Date | null | undefined) {
    const ticker = symbol.trim().toUpperCase();
    if (!ticker || !time || Number.isNaN(time.getTime())) {
      return;
    }
    const ms = time.getTime();
    const prev = map[ticker];
    if (prev == null || ms < prev) {
      map[ticker] = ms;
    }
  }

  for (const operation of parsed.cashOperations) {
    if (operation.kind === "purchase" || operation.kind === "sale") {
      bump(operation.symbol, operation.time);
    }
  }
  for (const position of parsed.closedPositions) {
    bump(position.symbol, position.openTime ?? position.closeTime);
  }
  for (const position of parsed.openPositions ?? []) {
    bump(position.symbol, position.openTime ?? undefined);
  }
  return map;
}

export function latestPriceByTicker(prices: PricesByTicker): Record<string, number> {
  const latest: Record<string, number> = {};
  for (const [ticker, rows] of Object.entries(prices)) {
    if (!rows || rows.length === 0) {
      continue;
    }
    latest[ticker] = rows[rows.length - 1]!.close_price;
  }
  return latest;
}

export function holdingsValueAt(
  timeMs: number,
  lots: ShareLot[],
  prices: PricesByTicker,
): number | null {
  if (lots.length === 0) {
    return 0;
  }

  const day = toIsoDay(timeMs);
  let total = 0;

  for (const lot of lots) {
    if (timeMs < lot.openMs) {
      continue;
    }
    if (lot.closeMs != null && timeMs >= lot.closeMs) {
      continue;
    }
    const price = priceOnOrBefore(prices[lot.ticker], day);
    if (price == null) {
      return null;
    }
    total += lot.volume * price;
  }

  return total;
}

function cashBalanceAt(
  operations: CashOperation[],
  timeMs: number,
  treatTransfersAsExternal: boolean,
  hasClosedPositions: boolean,
): number {
  const internalKeys = treatTransfersAsExternal
    ? new Set<string>()
    : findInternalTransferKeys(operations);

  let balance = 0;
  for (const operation of operations) {
    if (operation.time.getTime() > timeMs) {
      continue;
    }

    if (operation.kind === "transfer") {
      if (isSubaccountTransfer(operation.rawType)) {
        continue;
      }
      if (!isExternalTransfer(operation, treatTransfersAsExternal ? new Set() : internalKeys)) {
        continue;
      }
      balance += operation.amount;
      continue;
    }

    if (hasClosedPositions && duplicatesClosedPositionPnl(operation.kind)) {
      continue;
    }

    balance += operation.amount;
  }
  return balance;
}

function netCapitalAt(
  operations: CashOperation[],
  timeMs: number,
  treatTransfersAsExternal: boolean,
): { deposits: number; withdrawals: number } {
  const internalKeys = treatTransfersAsExternal
    ? new Set<string>()
    : findInternalTransferKeys(operations);

  let deposits = 0;
  let withdrawals = 0;

  for (const operation of operations) {
    if (operation.time.getTime() > timeMs) {
      continue;
    }

    if (operation.kind === "deposit") {
      deposits += Math.abs(operation.amount);
      continue;
    }
    if (operation.kind === "withdrawal") {
      withdrawals += Math.abs(operation.amount);
      continue;
    }
    if (operation.kind === "transfer") {
      if (isSubaccountTransfer(operation.rawType)) {
        continue;
      }
      if (!isExternalTransfer(operation, treatTransfersAsExternal ? new Set() : internalKeys)) {
        continue;
      }
      if (operation.amount > 0) {
        deposits += Math.abs(operation.amount);
      } else {
        withdrawals += Math.abs(operation.amount);
      }
    }
  }

  return { deposits, withdrawals };
}

/**
 * Oś czasu MTM: dni sesyjne z cen + zdarzenia gotówkowe/pozycji.
 * Dzięki dniom sesyjnym wykres „faluje” codziennie, a nie tylko przy transakcjach.
 */
function collectTimelineMs(parsed: ParsedXtbFile, prices: PricesByTicker): number[] {
  const times = new Set<number>();

  for (const operation of parsed.cashOperations) {
    times.add(operation.time.getTime());
  }
  for (const position of parsed.closedPositions) {
    if (position.openTime) {
      times.add(position.openTime.getTime());
    }
    times.add(position.closeTime.getTime());
  }
  for (const position of parsed.openPositions ?? []) {
    if (position.openTime) {
      times.add(position.openTime.getTime());
    }
  }

  for (const rows of Object.values(prices)) {
    for (const row of rows) {
      times.add(Date.parse(`${row.date}T16:00:00.000Z`));
    }
  }

  return [...times].filter((ms) => Number.isFinite(ms)).sort((a, b) => a - b);
}

export type MarketChartResult = {
  chart: ChartPoint[];
  usedMarket: boolean;
  pricedLots: number;
};

/**
 * Wartość = saldo gotówki + Σ(liczba akcji × close z asset_prices) na każdy dzień sesyjny.
 */
export function enrichChartWithMarketPrices(
  baseChart: ChartPoint[],
  parsed: ParsedXtbFile,
  prices: PricesByTicker,
  options: { treatTransfersAsExternal?: boolean } = {},
): MarketChartResult {
  const treatTransfersAsExternal = options.treatTransfersAsExternal ?? false;
  const latest = latestPriceByTicker(prices);
  const openFrom = earliestActivityByTicker(parsed);
  const lots = buildShareLots(parsed, latest, openFrom);

  const hasAnyPrices = Object.values(prices).some((rows) => rows.length > 0);
  if (lots.length === 0 || !hasAnyPrices) {
    return { chart: baseChart, usedMarket: false, pricedLots: 0 };
  }

  const timeline = collectTimelineMs(parsed, prices);
  if (timeline.length === 0) {
    return { chart: baseChart, usedMarket: false, pricedLots: lots.length };
  }

  const depositMarkers = new Map<number, { deposit: number; withdrawal: number }>();
  for (const point of baseChart) {
    if (point.depositDelta > 0 || point.withdrawalDelta > 0) {
      depositMarkers.set(point.time, {
        deposit: point.depositDelta,
        withdrawal: point.withdrawalDelta,
      });
    }
  }

  // Markery wpłat po dniu (gdy oś jest gęsta od cen).
  const depositByDay = new Map<string, { deposit: number; withdrawal: number }>();
  for (const point of baseChart) {
    if (point.depositDelta <= 0 && point.withdrawalDelta <= 0) {
      continue;
    }
    const day = toIsoDay(point.time);
    const prev = depositByDay.get(day) ?? { deposit: 0, withdrawal: 0 };
    depositByDay.set(day, {
      deposit: prev.deposit + point.depositDelta,
      withdrawal: prev.withdrawal + point.withdrawalDelta,
    });
  }

  const chart: ChartPoint[] = [];
  let usedMarket = false;
  const emittedDepositDays = new Set<string>();

  for (const time of timeline) {
    const holdings = holdingsValueAt(time, lots, prices);
    if (holdings == null) {
      continue;
    }
    usedMarket = true;

    const cash = cashBalanceAt(
      parsed.cashOperations,
      time,
      treatTransfersAsExternal,
      parsed.closedPositions.length > 0,
    );
    const { deposits, withdrawals } = netCapitalAt(
      parsed.cashOperations,
      time,
      treatTransfersAsExternal,
    );
    const netCapital = deposits - withdrawals;
    const portfolioValue = cash + holdings;

    const day = toIsoDay(time);
    const exact = depositMarkers.get(time);
    let depositDelta = exact?.deposit ?? 0;
    let withdrawalDelta = exact?.withdrawal ?? 0;
    if (!exact && !emittedDepositDays.has(day)) {
      const byDay = depositByDay.get(day);
      if (byDay) {
        depositDelta = byDay.deposit;
        withdrawalDelta = byDay.withdrawal;
        emittedDepositDays.add(day);
      }
    } else if (exact) {
      emittedDepositDays.add(day);
    }

    const point: ChartPoint = {
      time,
      label: formatChartLabel(new Date(time)),
      netCapital,
      portfolioValue,
      investedCapital: netCapital,
      cumulativeGain: portfolioValue - netCapital,
      depositDelta,
      withdrawalDelta,
    };

    const last = chart[chart.length - 1];
    if (last && last.time === time) {
      chart[chart.length - 1] = {
        ...point,
        depositDelta: last.depositDelta + point.depositDelta,
        withdrawalDelta: last.withdrawalDelta + point.withdrawalDelta,
      };
      continue;
    }
    chart.push(point);
  }

  if (!usedMarket || chart.length === 0) {
    return { chart: baseChart, usedMarket: false, pricedLots: lots.length };
  }

  return { chart, usedMarket: true, pricedLots: lots.length };
}

/** Grupuje wiersze cen po tickerze (posortowane po dacie). */
export function groupPricesByTicker(rows: AssetPriceRow[]): PricesByTicker {
  const map: PricesByTicker = {};
  for (const row of rows) {
    const ticker = row.ticker.trim().toUpperCase();
    if (!map[ticker]) {
      map[ticker] = [];
    }
    map[ticker].push(row);
  }
  for (const ticker of Object.keys(map)) {
    map[ticker]!.sort((a, b) => a.date.localeCompare(b.date));
  }
  return map;
}

export function mergeAssetPriceRows(...groups: AssetPriceRow[][]): AssetPriceRow[] {
  const map = new Map<string, AssetPriceRow>();
  for (const rows of groups) {
    for (const row of rows) {
      map.set(`${row.ticker.toUpperCase()}|${row.date}`, {
        ...row,
        ticker: row.ticker.toUpperCase(),
      });
    }
  }
  return [...map.values()].sort((a, b) =>
    a.ticker === b.ticker ? a.date.localeCompare(b.date) : a.ticker.localeCompare(b.ticker),
  );
}
