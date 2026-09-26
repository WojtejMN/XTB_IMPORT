import { isSubaccountTransfer } from "../xtb/classify";
import { isPlnMarketTicker } from "../prices/yahoo-ticker";
import type { AssetPriceRow } from "../prices/supabase";
import { mergeParsedFiles } from "../xtb/merge";
import type { AccountKind, CashOperation, ChartPoint, ParsedXtbFile } from "../xtb/types";
import { groupPricesByTicker, priceOnOrBefore, type PricesByTicker } from "./market-value";
import { findInternalTransferKeys, isExternalTransfer } from "./transfers";

const DAY_MS = 24 * 60 * 60 * 1000;

export type DailySeriesPoint = {
  /** YYYY-MM-DD */
  date: string;
  /** Gotówka + wycena pozycji. */
  portfolioValue: number;
  /** Wpłaty − wypłaty. Ujemny, gdy wypłacono więcej niż wpłacono. */
  netCapital: number;
  /** portfolioValue − netCapital. */
  totalProfit: number;
  /** Wpłaty tego dnia. */
  depositDelta: number;
  /** Wypłaty tego dnia. */
  withdrawalDelta: number;
};

export type DailySeriesOptions = {
  /** Jedno konto: każdy transfer to przepływ zewnętrzny. */
  treatTransfersAsExternal?: boolean;
  /** Ostatni dzień serii (domyślnie: ostatnie dane). */
  until?: Date;
};

/** Pozycja do wyceny: ilość w czasie + cena (rynkowa albo koszt). */
type ValuationLot = {
  ticker: string;
  openMs: number;
  closeMs: number | null;
  volume: number;
  /** Koszt jednostkowy w PLN — używany, gdy brak notowań. */
  costPerUnit: number | null;
  /** Wycena rynkowa tylko dla instrumentów notowanych w PLN. */
  usesMarketPrice: boolean;
};

export function toIsoDay(value: Date | number): string {
  const ms = typeof value === "number" ? value : value.getTime();
  return new Date(ms).toISOString().slice(0, 10);
}

function dayStartMs(isoDay: string): number {
  return Date.parse(`${isoDay}T00:00:00.000Z`);
}

/** Koniec dnia — operacje z danego dnia liczymy do jego zamknięcia. */
function dayEndMs(isoDay: string): number {
  return dayStartMs(isoDay) + DAY_MS - 1;
}

function isDepositFlow(operation: CashOperation): boolean {
  return operation.kind === "deposit";
}

function isWithdrawalFlow(operation: CashOperation): boolean {
  return operation.kind === "withdrawal";
}

function buildValuationLots(parsed: ParsedXtbFile): ValuationLot[] {
  const lots: ValuationLot[] = [];

  for (const position of parsed.closedPositions) {
    const ticker = position.symbol.trim().toUpperCase();
    if (!ticker || position.volume == null || position.volume <= 0) {
      continue;
    }
    const openMs = (position.openTime ?? position.closeTime).getTime();
    lots.push({
      ticker,
      openMs,
      closeMs: position.closeTime.getTime(),
      volume: position.volume,
      costPerUnit: position.openPrice ?? null,
      usesMarketPrice: isPlnMarketTicker(ticker),
    });
  }

  for (const position of parsed.openPositions ?? []) {
    const ticker = position.symbol.trim().toUpperCase();
    if (!ticker) {
      continue;
    }

    const volume = position.volume != null && position.volume > 0 ? position.volume : null;
    if (volume == null) {
      continue;
    }

    const costPerUnit =
      position.openPrice != null && position.openPrice > 0
        ? position.openPrice
        : position.value != null && position.value > 0
          ? position.value / volume
          : null;

    lots.push({
      ticker,
      openMs: position.openTime?.getTime() ?? Number.NEGATIVE_INFINITY,
      closeMs: null,
      volume,
      costPerUnit,
      usesMarketPrice: isPlnMarketTicker(ticker),
    });
  }

  return lots;
}

function lotPriceAt(lot: ValuationLot, isoDay: string, prices: PricesByTicker): number | null {
  if (lot.usesMarketPrice) {
    const market = priceOnOrBefore(prices[lot.ticker], isoDay);
    if (market != null) {
      return market;
    }
  }
  // Brak notowań (albo instrument w obcej walucie) — wyceniamy po koszcie w PLN.
  return lot.costPerUnit;
}

function holdingsValueAt(timeMs: number, isoDay: string, lots: ValuationLot[], prices: PricesByTicker): number {
  let total = 0;
  for (const lot of lots) {
    if (timeMs < lot.openMs) {
      continue;
    }
    if (lot.closeMs != null && timeMs >= lot.closeMs) {
      continue;
    }
    const price = lotPriceAt(lot, isoDay, prices);
    if (price == null) {
      continue;
    }
    total += lot.volume * price;
  }
  return total;
}

function lastPriceDayMs(prices: PricesByTicker): number | null {
  let latest: string | null = null;
  for (const rows of Object.values(prices)) {
    const last = rows[rows.length - 1];
    if (last && (latest == null || last.date > latest)) {
      latest = last.date;
    }
  }
  return latest ? dayStartMs(latest) : null;
}

/**
 * Dzienna seria portfela dla jednego zestawu plików.
 *
 * netCapital(t)     = Σ wpłat(≤t) − Σ wypłat(≤t)      — może być ujemny
 * portfolioValue(t) = gotówka(t) + Σ(ilość(t) × cena(t))
 * totalProfit(t)    = portfolioValue(t) − netCapital(t)
 */
export function buildDailySeries(
  parsed: ParsedXtbFile,
  prices: PricesByTicker = {},
  options: DailySeriesOptions = {},
): DailySeriesPoint[] {
  const treatTransfersAsExternal = options.treatTransfersAsExternal ?? false;
  const internalKeys = treatTransfersAsExternal
    ? new Set<string>()
    : findInternalTransferKeys(parsed.cashOperations);

  const operations = [...parsed.cashOperations].sort(
    (a, b) => a.time.getTime() - b.time.getTime(),
  );
  const lots = buildValuationLots(parsed);

  if (operations.length === 0 && lots.length === 0) {
    return [];
  }

  const eventTimes: number[] = [
    ...operations.map((operation) => operation.time.getTime()),
    ...lots.filter((lot) => Number.isFinite(lot.openMs)).map((lot) => lot.openMs),
    ...lots
      .map((lot) => lot.closeMs)
      .filter((ms): ms is number => ms != null),
  ];
  if (eventTimes.length === 0) {
    return [];
  }

  const firstMs = Math.min(...eventTimes);
  const lastPriceMs = lastPriceDayMs(prices);
  const untilMs = options.until?.getTime() ?? null;
  const lastMs = Math.max(
    Math.max(...eventTimes),
    lastPriceMs ?? Number.NEGATIVE_INFINITY,
    untilMs ?? Number.NEGATIVE_INFINITY,
  );

  const series: DailySeriesPoint[] = [];
  let cursor = 0;
  let cash = 0;
  let deposits = 0;
  let withdrawals = 0;

  for (let dayMs = dayStartMs(toIsoDay(firstMs)); dayMs <= lastMs; dayMs += DAY_MS) {
    const isoDay = toIsoDay(dayMs);
    const cutoff = dayEndMs(isoDay);
    let depositDelta = 0;
    let withdrawalDelta = 0;

    while (cursor < operations.length && operations[cursor]!.time.getTime() <= cutoff) {
      const operation = operations[cursor]!;
      cursor += 1;

      if (operation.kind === "transfer") {
        // Subkonto i sparowane transfery IKE↔PLN nie zmieniają portfela inwestora.
        if (isSubaccountTransfer(operation.rawType)) {
          continue;
        }
        if (!isExternalTransfer(operation, internalKeys)) {
          continue;
        }
        cash += operation.amount;
        if (operation.amount > 0) {
          deposits += Math.abs(operation.amount);
          depositDelta += Math.abs(operation.amount);
        } else {
          withdrawals += Math.abs(operation.amount);
          withdrawalDelta += Math.abs(operation.amount);
        }
        continue;
      }

      if (isDepositFlow(operation)) {
        const value = Math.abs(operation.amount);
        cash += value;
        deposits += value;
        depositDelta += value;
        continue;
      }

      if (isWithdrawalFlow(operation)) {
        const value = Math.abs(operation.amount);
        cash -= value;
        withdrawals += value;
        withdrawalDelta += value;
        continue;
      }

      // Zakupy, sprzedaże, dywidendy, podatki, odsetki, P/L — realne ruchy gotówki.
      cash += operation.amount;
    }

    const holdings = holdingsValueAt(cutoff, isoDay, lots, prices);
    const netCapital = deposits - withdrawals;
    const portfolioValue = cash + holdings;

    series.push({
      date: isoDay,
      portfolioValue,
      netCapital,
      totalProfit: portfolioValue - netCapital,
      depositDelta,
      withdrawalDelta,
    });
  }

  return series;
}

/** Seria dzienna per konto — każde konto liczone osobno. */
export function buildDailySeriesPerAccount(
  files: ParsedXtbFile[],
  kinds: AccountKind[],
  prices: PricesByTicker = {},
  options: DailySeriesOptions = {},
): Partial<Record<AccountKind, DailySeriesPoint[]>> {
  const result: Partial<Record<AccountKind, DailySeriesPoint[]>> = {};

  for (const kind of kinds) {
    const forKind = files.filter((file) => file.accountKind === kind);
    if (forKind.length === 0) {
      continue;
    }
    const merged = mergeParsedFiles(forKind, [kind]);
    result[kind] = buildDailySeries(merged, prices, {
      ...options,
      // Pojedyncze konto: transfer na inne konto to wypływ z tego konta.
      treatTransfersAsExternal: true,
    });
  }

  return result;
}

/**
 * Suma kont: najpierw sumujemy per dzień, potem liczymy zysk.
 * totalProfit = Σ portfolioValue − Σ netCapital.
 */
export function sumDailySeries(seriesList: DailySeriesPoint[][]): DailySeriesPoint[] {
  const present = seriesList.filter((series) => series.length > 0);
  if (present.length === 0) {
    return [];
  }
  if (present.length === 1) {
    return present[0]!;
  }

  const days = [...new Set(present.flatMap((series) => series.map((point) => point.date)))].sort();

  return days.map((date) => {
    let portfolioValue = 0;
    let netCapital = 0;
    let depositDelta = 0;
    let withdrawalDelta = 0;

    for (const series of present) {
      const point = pointOnOrBefore(series, date);
      if (!point) {
        continue;
      }
      portfolioValue += point.portfolioValue;
      netCapital += point.netCapital;
      if (point.date === date) {
        depositDelta += point.depositDelta;
        withdrawalDelta += point.withdrawalDelta;
      }
    }

    return {
      date,
      portfolioValue,
      netCapital,
      totalProfit: portfolioValue - netCapital,
      depositDelta,
      withdrawalDelta,
    };
  });
}

/** Ostatni punkt serii w dniu `date` albo wcześniej (seria bywa krótsza). */
function pointOnOrBefore(series: DailySeriesPoint[], date: string): DailySeriesPoint | null {
  let best: DailySeriesPoint | null = null;
  for (const point of series) {
    if (point.date <= date) {
      best = point;
    } else {
      break;
    }
  }
  return best;
}

function formatChartLabel(isoDay: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${isoDay}T00:00:00.000Z`));
}

/** Adapter dla Rechartsa — bez ucinania ujemnych wartości. */
export function toChartPoints(series: DailySeriesPoint[]): ChartPoint[] {
  return series.map((point) => ({
    time: dayStartMs(point.date),
    label: formatChartLabel(point.date),
    netCapital: point.netCapital,
    portfolioValue: point.portfolioValue,
    investedCapital: point.netCapital,
    cumulativeGain: point.totalProfit,
    depositDelta: point.depositDelta,
    withdrawalDelta: point.withdrawalDelta,
  }));
}

export type PortfolioDailySeries = {
  total: DailySeriesPoint[];
  perAccount: Partial<Record<AccountKind, DailySeriesPoint[]>>;
};

/**
 * Pełna seria wykresu: per konto oraz suma zaznaczonych kont.
 * Ceny podajemy jako wiersze `asset_prices` (albo prosto z Yahoo).
 */
export function buildPortfolioDailySeries(
  files: ParsedXtbFile[],
  kinds: AccountKind[],
  priceRows: AssetPriceRow[] = [],
  options: DailySeriesOptions = {},
): PortfolioDailySeries {
  const prices = groupPricesByTicker(priceRows);
  const perAccount = buildDailySeriesPerAccount(files, kinds, prices, options);
  const total = sumDailySeries(Object.values(perAccount).filter((series): series is DailySeriesPoint[] => Boolean(series)));
  return { total, perAccount };
}
