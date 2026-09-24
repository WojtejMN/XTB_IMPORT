import { duplicatesClosedPositionPnl, isSubaccountTransfer } from "../xtb/classify";
import type { AssetPriceRow } from "../prices/supabase";
import { guessCurrencyFromXtbTicker } from "../prices/yahoo-ticker";
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
 * Loty akcji do wyceny MTM.
 * Zamknięte: volume z arkusza Closed Positions.
 * Otwarte (.PL): volume ≈ value / ostatnia cena (gdy value i cena dostępne).
 */
export function buildShareLots(
  parsed: ParsedXtbFile,
  latestPrices: Record<string, number>,
  openFromMs: Record<string, number>,
): ShareLot[] {
  const lots: ShareLot[] = [];

  for (const position of parsed.closedPositions) {
    const ticker = position.symbol.trim().toUpperCase();
    if (!ticker || position.volume == null || position.volume <= 0) {
      continue;
    }
    if (guessCurrencyFromXtbTicker(ticker) !== "PLN") {
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
    if (!ticker || position.value == null || position.value <= 0) {
      continue;
    }
    if (guessCurrencyFromXtbTicker(ticker) !== "PLN") {
      continue;
    }
    const lastPrice = latestPrices[ticker];
    if (lastPrice == null || lastPrice <= 0) {
      continue;
    }
    const volume = position.value / lastPrice;
    if (!Number.isFinite(volume) || volume <= 0) {
      continue;
    }
    lots.push({
      ticker,
      openMs: openFromMs[ticker] ?? Date.now(),
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

  for (const rows of Object.values(prices)) {
    for (const row of rows) {
      times.add(Date.parse(`${row.date}T12:00:00.000Z`));
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
 * Buduje wykres wartości portfela: saldo gotówki + MTM pozycji GPW (.PL)
 * z dziennych cen Supabase. Bez lotów / cen wraca do wykresu bazowego.
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

  if (lots.length === 0 || Object.keys(prices).length === 0) {
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

  const chart: ChartPoint[] = [];
  let usedMarket = false;

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
    const investedCapital = Math.max(0, netCapital);
    const portfolioValue = Math.max(0, cash + holdings);
    const markers = depositMarkers.get(time) ?? { deposit: 0, withdrawal: 0 };

    const point: ChartPoint = {
      time,
      label: formatChartLabel(new Date(time)),
      netCapital,
      portfolioValue,
      investedCapital,
      cumulativeGain: Math.max(0, portfolioValue - investedCapital),
      depositDelta: markers.deposit,
      withdrawalDelta: markers.withdrawal,
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
