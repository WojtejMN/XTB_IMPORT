import { isSubaccountTransfer } from "../xtb/classify";
import { isMarketPriceTicker, isPlnMarketTicker } from "../prices/yahoo-ticker";
import type { AssetPriceRow } from "../prices/supabase";
import { mergeParsedFiles } from "../xtb/merge";
import type {
  AccountBreakdown,
  AccountKind,
  CashOperation,
  ChartPoint,
  ParsedXtbFile,
  PortfolioReport,
} from "../xtb/types";
import { groupPricesByTicker, priceOnOrBefore, type PricesByTicker } from "./market-value";
import { findInternalTransferKeys, isExternalTransfer } from "./transfers";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACCOUNT_ORDER: AccountKind[] = ["standard", "ike", "ikze"];

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
  /**
   * Transfery sparowane w obrębie całego zaznaczenia (IKE↔PLN).
   * Liczone raz dla wszystkich kont, żeby suma nie zawyżała wpłat i wypłat.
   */
  internalTransferKeys?: Set<string>;
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

function normalizeTicker(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/** Symbole, których kupno i sprzedaż widać w gotówce (akcje/ETF-y). */
function cashTradedSymbols(operations: CashOperation[]): Set<string> {
  const symbols = new Set<string>();
  for (const operation of operations) {
    if (operation.kind !== "purchase" && operation.kind !== "sale") {
      continue;
    }
    const ticker = normalizeTicker(operation.symbol);
    if (ticker) {
      symbols.add(ticker);
    }
  }
  return symbols;
}

/**
 * Loty wyceniane osobno od gotówki.
 *
 * Bierzemy tylko pozycje, za które gotówka faktycznie wyszła z rachunku:
 * zamknięte pozycje z legą kasową oraz otwarte pozycje w akcjach/ETF-ach.
 * CFD i krypto działają na depozycie — ich wynik wchodzi przez P/L, nie przez wartość.
 */
function buildValuationLots(parsed: ParsedXtbFile, cashTraded: Set<string>): ValuationLot[] {
  const lots: ValuationLot[] = [];

  for (const position of parsed.closedPositions) {
    const ticker = normalizeTicker(position.symbol);
    if (!ticker || position.volume == null || position.volume <= 0) {
      continue;
    }
    if (!cashTraded.has(ticker)) {
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
    const ticker = normalizeTicker(position.symbol);
    if (!ticker || !isMarketPriceTicker(ticker)) {
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

/**
 * P/L pozycji, których nie widać w gotówce (CFD, krypto) — dopisujemy
 * w dniu zamknięcia. Dla akcji zysk jest już w cenie sprzedaży.
 */
function realizedPnlEvents(
  parsed: ParsedXtbFile,
  cashTraded: Set<string>,
): Array<{ ms: number; amount: number }> {
  return parsed.closedPositions
    .filter((position) => !cashTraded.has(normalizeTicker(position.symbol)))
    .map((position) => ({ ms: position.closeTime.getTime(), amount: position.netProfit }))
    .sort((a, b) => a.ms - b.ms);
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

/**
 * Akcje kupione za gotówkę, których nie ma w arkuszach pozycji.
 *
 * Z notowaniami: ilość = kwota / kurs z dnia transakcji, wycena po kursie bieżącym.
 * Bez notowań: trzymamy koszt zakupu (sprzedaż zdejmuje go z powrotem,
 * a zysk zostaje w gotówce).
 */
class SyntheticHoldings {
  private readonly quantities = new Map<string, number>();

  constructor(
    private readonly covered: Set<string>,
    private readonly prices: PricesByTicker,
  ) {}

  private hasPrices(ticker: string): boolean {
    return (this.prices[ticker]?.length ?? 0) > 0;
  }

  apply(operation: CashOperation, isoDay: string): void {
    if (operation.kind !== "purchase" && operation.kind !== "sale") {
      return;
    }
    const ticker = normalizeTicker(operation.symbol);
    if (!ticker || this.covered.has(ticker) || !isMarketPriceTicker(ticker)) {
      return;
    }

    const amount = Math.abs(operation.amount);
    if (amount === 0) {
      return;
    }

    const unitPrice = this.hasPrices(ticker) ? priceOnOrBefore(this.prices[ticker], isoDay) : null;
    const units = unitPrice != null && unitPrice > 0 ? amount / unitPrice : amount;
    const current = this.quantities.get(ticker) ?? 0;
    const next = operation.kind === "purchase" ? current + units : current - units;
    this.quantities.set(ticker, Math.max(0, next));
  }

  valueAt(isoDay: string): number {
    let total = 0;
    for (const [ticker, quantity] of this.quantities) {
      if (quantity <= 0) {
        continue;
      }
      const price = this.hasPrices(ticker) ? priceOnOrBefore(this.prices[ticker], isoDay) : null;
      // Bez notowań jednostką jest złotówka kosztu, więc mnożnik wynosi 1.
      total += price != null && price > 0 ? quantity * price : quantity;
    }
    return total;
  }
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
  const internalKeys =
    options.internalTransferKeys ??
    (treatTransfersAsExternal ? new Set<string>() : findInternalTransferKeys(parsed.cashOperations));

  const operations = [...parsed.cashOperations].sort(
    (a, b) => a.time.getTime() - b.time.getTime(),
  );
  const cashTraded = cashTradedSymbols(operations);
  const lots = buildValuationLots(parsed, cashTraded);
  const pnlEvents = realizedPnlEvents(parsed, cashTraded);
  const lotTickers = new Set(lots.map((lot) => lot.ticker));

  if (operations.length === 0 && lots.length === 0) {
    return [];
  }

  const eventTimes: number[] = [
    ...operations.map((operation) => operation.time.getTime()),
    ...pnlEvents.map((event) => event.ms),
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
  let pnlCursor = 0;
  let cash = 0;
  let deposits = 0;
  let withdrawals = 0;
  // Akcje kupione za gotówkę, których nie ma w arkuszach pozycji.
  const synthetic = new SyntheticHoldings(lotTickers, prices);

  for (let dayMs = dayStartMs(toIsoDay(firstMs)); dayMs <= lastMs; dayMs += DAY_MS) {
    const isoDay = toIsoDay(dayMs);
    const cutoff = dayEndMs(isoDay);
    let depositDelta = 0;
    let withdrawalDelta = 0;

    while (pnlCursor < pnlEvents.length && pnlEvents[pnlCursor]!.ms <= cutoff) {
      cash += pnlEvents[pnlCursor]!.amount;
      pnlCursor += 1;
    }

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
      synthetic.apply(operation, isoDay);
    }

    const holdings =
      holdingsValueAt(cutoff, isoDay, lots, prices) + synthetic.valueAt(isoDay);
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

  // Parowanie liczymy na całym zaznaczeniu: transfer IKE↔PLN ma obie nogi
  // tylko wtedy, gdy oba konta są zaznaczone. Inaczej to przepływ zewnętrzny.
  const selectedOperations = files
    .filter((file) => kinds.includes(file.accountKind))
    .flatMap((file) => file.cashOperations);
  const internalTransferKeys =
    options.internalTransferKeys ?? findInternalTransferKeys(selectedOperations);

  for (const kind of kinds) {
    const forKind = files.filter((file) => file.accountKind === kind);
    if (forKind.length === 0) {
      continue;
    }
    const merged = mergeParsedFiles(forKind, [kind]);
    result[kind] = buildDailySeries(merged, prices, {
      ...options,
      internalTransferKeys,
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

export type SeriesTotals = {
  portfolioValue: number;
  netCapital: number;
  totalProfit: number;
  totalDeposits: number;
  totalWithdrawals: number;
};

/**
 * Podsumowanie liczone z ostatniego punktu serii — kafelki i wykres
 * muszą pokazywać tę samą liczbę.
 */
export function summarizeDailySeries(series: DailySeriesPoint[]): SeriesTotals | null {
  const last = series[series.length - 1];
  if (!last) {
    return null;
  }

  let totalDeposits = 0;
  let totalWithdrawals = 0;
  for (const point of series) {
    totalDeposits += point.depositDelta;
    totalWithdrawals += point.withdrawalDelta;
  }

  return {
    portfolioValue: last.portfolioValue,
    netCapital: last.netCapital,
    totalProfit: last.totalProfit,
    totalDeposits,
    totalWithdrawals,
  };
}

/** Nadpisuje w raporcie liczby, które muszą zgadzać się z wykresem. */
export function syncReportWithSeries(
  report: PortfolioReport,
  totals: SeriesTotals | null,
): PortfolioReport {
  if (!totals) {
    return report;
  }

  return {
    ...report,
    portfolioValue: totals.portfolioValue,
    totalProfit: totals.totalProfit,
    netDeposits: totals.netCapital,
    totalDeposits: totals.totalDeposits,
    totalWithdrawals: totals.totalWithdrawals,
    unrealizedProfit: totals.totalProfit - report.realizedProfit,
    totalReturn: totals.totalDeposits > 0 ? totals.totalProfit / totals.totalDeposits : null,
  };
}

/** Kafelki „Wartość per konto” z tych samych serii co linie na wykresie. */
export function accountBreakdownFromSeries(
  perAccount: Partial<Record<AccountKind, DailySeriesPoint[]>>,
): AccountBreakdown[] {
  const breakdown: AccountBreakdown[] = [];

  for (const kind of ACCOUNT_ORDER) {
    const series = perAccount[kind];
    if (!series || series.length === 0) {
      continue;
    }
    const totals = summarizeDailySeries(series);
    if (!totals) {
      continue;
    }
    breakdown.push({
      kind,
      portfolioValue: totals.portfolioValue,
      totalProfit: totals.totalProfit,
      netDeposits: totals.netCapital,
      totalDeposits: totals.totalDeposits,
      totalWithdrawals: totals.totalWithdrawals,
    });
  }

  return breakdown;
}

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
