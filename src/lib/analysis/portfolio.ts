import { duplicatesClosedPositionPnl, isProfitKind, isSubaccountTransfer } from "../xtb/classify";
import { aggregateSymbolProfits } from "../xtb/symbol-profit";
import { mergeParsedFiles } from "../xtb/merge";
import type {
  AccountBreakdown,
  AccountKind,
  AnalyzeOptions,
  CashOperation,
  ChartPoint,
  KindCounts,
  ParsedXtbFile,
  PortfolioMetrics,
  PortfolioReport,
} from "../xtb/types";
import { xirr, type CashFlow } from "./xirr";

type TimelineEvent = {
  time: Date;
  depositDelta: number;
  withdrawalDelta: number;
  profitDelta: number;
};

function formatChartLabel(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function inboundTransfer(operation: CashOperation): boolean {
  return (
    operation.kind === "transfer" &&
    operation.amount > 0 &&
    !isSubaccountTransfer(operation.rawType)
  );
}

function outboundTransfer(operation: CashOperation): boolean {
  return (
    operation.kind === "transfer" &&
    operation.amount < 0 &&
    !isSubaccountTransfer(operation.rawType)
  );
}

function buildEvents(
  parsed: ParsedXtbFile,
  treatTransfersAsExternal: boolean,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const operation of parsed.cashOperations) {
    if (operation.kind === "deposit") {
      events.push({
        time: operation.time,
        depositDelta: Math.abs(operation.amount),
        withdrawalDelta: 0,
        profitDelta: 0,
      });
      continue;
    }

    if (operation.kind === "withdrawal") {
      events.push({
        time: operation.time,
        depositDelta: 0,
        withdrawalDelta: Math.abs(operation.amount),
        profitDelta: 0,
      });
      continue;
    }

    if (treatTransfersAsExternal && inboundTransfer(operation)) {
      events.push({
        time: operation.time,
        depositDelta: Math.abs(operation.amount),
        withdrawalDelta: 0,
        profitDelta: 0,
      });
      continue;
    }

    if (treatTransfersAsExternal && outboundTransfer(operation)) {
      events.push({
        time: operation.time,
        depositDelta: 0,
        withdrawalDelta: Math.abs(operation.amount),
        profitDelta: 0,
      });
      continue;
    }

    if (
      parsed.closedPositions.length > 0 &&
      duplicatesClosedPositionPnl(operation.kind)
    ) {
      continue;
    }

    if (isProfitKind(operation.kind)) {
      events.push({
        time: operation.time,
        depositDelta: 0,
        withdrawalDelta: 0,
        profitDelta: operation.amount,
      });
    }
  }

  for (const position of parsed.closedPositions) {
    events.push({
      time: position.closeTime,
      depositDelta: 0,
      withdrawalDelta: 0,
      profitDelta: position.netProfit,
    });
  }

  return events.sort((a, b) => a.time.getTime() - b.time.getTime());
}

type ChartBuildOptions = {
  unrealizedAtEnd: number;
  investmentStart: number | null;
  investmentEnd: number;
};

function firstInvestmentTime(parsed: ParsedXtbFile): number | null {
  let earliest: number | null = null;

  for (const operation of parsed.cashOperations) {
    if (operation.kind !== "purchase") {
      continue;
    }
    const time = operation.time.getTime();
    if (earliest == null || time < earliest) {
      earliest = time;
    }
  }

  for (const position of parsed.closedPositions) {
    if (position.openTime == null) {
      continue;
    }
    const time = position.openTime.getTime();
    if (earliest == null || time < earliest) {
      earliest = time;
    }
  }

  return earliest;
}

function estimatedUnrealized(
  time: number,
  unrealizedAtEnd: number,
  investmentStart: number | null,
  investmentEnd: number,
): number {
  if (unrealizedAtEnd === 0) {
    return 0;
  }
  if (investmentStart == null || investmentEnd <= investmentStart) {
    return time >= investmentEnd ? unrealizedAtEnd : 0;
  }
  if (time <= investmentStart) {
    return 0;
  }
  if (time >= investmentEnd) {
    return unrealizedAtEnd;
  }
  const fraction = (time - investmentStart) / (investmentEnd - investmentStart);
  return unrealizedAtEnd * fraction;
}

function makeChartPoint(
  time: number,
  label: string,
  netCapital: number,
  portfolioValue: number,
  depositDelta: number,
  withdrawalDelta: number,
): ChartPoint {
  const investedCapital = Math.max(0, netCapital);
  const cumulativeGain = Math.max(0, portfolioValue - investedCapital);
  return {
    time,
    label,
    netCapital,
    portfolioValue,
    investedCapital,
    cumulativeGain,
    depositDelta,
    withdrawalDelta,
  };
}

function buildChart(events: TimelineEvent[], options: ChartBuildOptions): ChartPoint[] {
  let deposits = 0;
  let withdrawals = 0;
  let portfolio = 0;
  const points: ChartPoint[] = [];

  if (events.length === 0) {
    return points;
  }

  function portfolioValueAt(time: number): number {
    const unrealized = estimatedUnrealized(
      time,
      options.unrealizedAtEnd,
      options.investmentStart,
      options.investmentEnd,
    );
    return Math.max(0, portfolio) + unrealized;
  }

  points.push(
    makeChartPoint(
      events[0].time.getTime() - 1,
      formatChartLabel(events[0].time),
      0,
      0,
      0,
      0,
    ),
  );

  for (const event of events) {
    deposits += event.depositDelta;
    withdrawals += event.withdrawalDelta;
    portfolio += event.depositDelta + event.profitDelta;
    if (event.withdrawalDelta > 0) {
      portfolio = Math.max(0, portfolio - event.withdrawalDelta);
    }

    const netCapital = deposits - withdrawals;
    const time = event.time.getTime();
    const value = portfolioValueAt(time);
    const last = points[points.length - 1];
    if (last && last.time === time) {
      const merged = makeChartPoint(
        time,
        formatChartLabel(event.time),
        netCapital,
        value,
        last.depositDelta + event.depositDelta,
        last.withdrawalDelta + event.withdrawalDelta,
      );
      points[points.length - 1] = merged;
      continue;
    }
    points.push(
      makeChartPoint(
        time,
        formatChartLabel(event.time),
        netCapital,
        value,
        event.depositDelta,
        event.withdrawalDelta,
      ),
    );
  }

  return points;
}

function investorCashFlows(
  cashOperations: CashOperation[],
  terminalDate: Date,
  terminalValue: number,
  treatTransfersAsExternal: boolean,
): CashFlow[] {
  const flows: CashFlow[] = [];

  for (const operation of cashOperations) {
    if (operation.kind === "deposit") {
      flows.push({ date: operation.time, amount: -Math.abs(operation.amount) });
    } else if (operation.kind === "withdrawal") {
      flows.push({ date: operation.time, amount: Math.abs(operation.amount) });
    } else if (treatTransfersAsExternal && inboundTransfer(operation)) {
      flows.push({ date: operation.time, amount: -Math.abs(operation.amount) });
    } else if (treatTransfersAsExternal && outboundTransfer(operation)) {
      flows.push({ date: operation.time, amount: Math.abs(operation.amount) });
    }
  }

  flows.push({ date: terminalDate, amount: terminalValue });
  return flows;
}

function countKinds(parsed: ParsedXtbFile): KindCounts {
  const counts: KindCounts = {};
  for (const operation of parsed.cashOperations) {
    counts[operation.kind] = (counts[operation.kind] ?? 0) + 1;
  }
  return counts;
}

function sumCashByKind(parsed: ParsedXtbFile, kind: CashOperation["kind"]): number {
  return parsed.cashOperations
    .filter((operation) => operation.kind === kind)
    .reduce((sum, operation) => sum + operation.amount, 0);
}

function computeMetrics(parsed: ParsedXtbFile, firstDate: Date | null, lastDate: Date | null): PortfolioMetrics {
  const totalDividends = sumCashByKind(parsed, "dividend");
  const totalInterest = sumCashByKind(parsed, "interest");
  const totalWithholdingTax = sumCashByKind(parsed, "withholding_tax");
  const totalCommissions = sumCashByKind(parsed, "commission");
  const totalInterestTax = sumCashByKind(parsed, "interest_tax");
  const totalFeesAndTaxes =
    Math.abs(totalCommissions) +
    Math.abs(totalWithholdingTax) +
    Math.abs(totalInterestTax);

  const internalTransferCount = parsed.cashOperations.filter(
    (operation) => operation.kind === "transfer" && isSubaccountTransfer(operation.rawType),
  ).length;

  const closed = parsed.closedPositions;
  const winners = closed.filter((position) => position.netProfit > 0).length;
  const winRate = closed.length > 0 ? winners / closed.length : null;

  const holdingDays = closed
    .filter((position) => position.openTime != null)
    .map((position) => {
      const open = position.openTime!.getTime();
      const close = position.closeTime.getTime();
      return Math.max(0, Math.round((close - open) / (1000 * 60 * 60 * 24)));
    });
  const avgHoldingDays =
    holdingDays.length > 0
      ? holdingDays.reduce((sum, days) => sum + days, 0) / holdingDays.length
      : null;

  const sortedByProfit = [...closed].sort((a, b) => b.netProfit - a.netProfit);
  const bestPosition =
    sortedByProfit.length > 0
      ? { symbol: sortedByProfit[0].symbol, profit: sortedByProfit[0].netProfit }
      : null;
  const worstPosition =
    sortedByProfit.length > 0
      ? {
          symbol: sortedByProfit[sortedByProfit.length - 1].symbol,
          profit: sortedByProfit[sortedByProfit.length - 1].netProfit,
        }
      : null;

  const topSymbols = aggregateSymbolProfits(parsed).slice(0, 5);

  const investingDays =
    firstDate && lastDate
      ? Math.max(0, Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

  return {
    totalDividends,
    totalInterest,
    totalWithholdingTax,
    totalCommissions,
    totalFeesAndTaxes,
    internalTransferCount,
    winRate,
    avgHoldingDays,
    bestPosition,
    worstPosition,
    topSymbols,
    investingDays,
  };
}

export function analyzeAccountBreakdown(
  files: ParsedXtbFile[],
  kinds: AccountKind[],
): AccountBreakdown[] {
  const breakdown: AccountBreakdown[] = [];
  for (const kind of kinds) {
    const forKind = files.filter((file) => file.accountKind === kind);
    if (forKind.length === 0) {
      continue;
    }
    const merged = mergeParsedFiles(forKind, [kind]);
    const report = analyzePortfolio(merged, { treatTransfersAsExternal: true });
    breakdown.push({
      kind,
      portfolioValue: report.portfolioValue,
      totalProfit: report.totalProfit,
      netDeposits: report.netDeposits,
      totalDeposits: report.totalDeposits,
      totalWithdrawals: report.totalWithdrawals,
    });
  }
  return breakdown;
}

export function analyzePerAccountCharts(
  files: ParsedXtbFile[],
  kinds: AccountKind[],
): Partial<Record<AccountKind, ChartPoint[]>> {
  const charts: Partial<Record<AccountKind, ChartPoint[]>> = {};
  for (const kind of kinds) {
    const forKind = files.filter((file) => file.accountKind === kind);
    if (forKind.length === 0) {
      continue;
    }
    const merged = mergeParsedFiles(forKind, [kind]);
    const report = analyzePortfolio(merged, { treatTransfersAsExternal: true });
    charts[kind] = report.chart;
  }
  return charts;
}

export function analyzePortfolio(
  parsed: ParsedXtbFile,
  options: AnalyzeOptions = {},
): PortfolioReport {
  const treatTransfersAsExternal = options.treatTransfersAsExternal ?? false;
  const events = buildEvents(parsed, treatTransfersAsExternal);
  const totalDeposits = events.reduce((sum, event) => sum + event.depositDelta, 0);
  const totalWithdrawals = events.reduce((sum, event) => sum + event.withdrawalDelta, 0);
  const realizedProfit = events.reduce((sum, event) => sum + event.profitDelta, 0);
  const netDeposits = totalDeposits - totalWithdrawals;
  const kindCounts = countKinds(parsed);

  const estimatedEquity = netDeposits + realizedProfit;
  const currentValue = options.currentAccountValue;
  const hasCurrentValue = currentValue != null && Number.isFinite(currentValue);
  const openProfit = parsed.openProfit ?? 0;
  const hasOpenProfit = parsed.openProfit != null && Number.isFinite(parsed.openProfit);
  const unrealizedProfit = hasCurrentValue
    ? currentValue - estimatedEquity
    : hasOpenProfit
      ? openProfit
      : 0;
  const totalProfit = hasCurrentValue ? currentValue - netDeposits : realizedProfit + unrealizedProfit;
  const portfolioValue = netDeposits + totalProfit;

  const dates = events.map((event) => event.time);
  const firstDate = dates[0] ?? null;
  const lastEventDate = dates[dates.length - 1] ?? null;
  const lastDate = hasCurrentValue ? new Date() : lastEventDate;

  const investmentStart = firstInvestmentTime(parsed);
  const investmentEnd = lastEventDate?.getTime() ?? Date.now();
  const chart = buildChart(events, {
    unrealizedAtEnd: unrealizedProfit,
    investmentStart,
    investmentEnd,
  });
  if (chart.length > 0) {
    const last = chart[chart.length - 1];
    if (hasCurrentValue && lastDate && lastDate.getTime() > last.time) {
      chart.push(
        makeChartPoint(
          lastDate.getTime(),
          formatChartLabel(lastDate),
          netDeposits,
          currentValue!,
          0,
          0,
        ),
      );
    } else {
      const patched = makeChartPoint(
        last.time,
        last.label,
        netDeposits,
        portfolioValue,
        last.depositDelta,
        last.withdrawalDelta,
      );
      chart[chart.length - 1] = patched;
    }
  }

  const terminalValue = hasCurrentValue ? currentValue : estimatedEquity + unrealizedProfit;
  const terminalForXirr = lastDate ?? new Date();
  const annualReturn =
    firstDate && lastDate
      ? xirr(
          investorCashFlows(
            parsed.cashOperations,
            terminalForXirr,
            terminalValue,
            treatTransfersAsExternal,
          ),
        )
      : null;

  const warnings = [...parsed.warnings];
  const unknown = parsed.cashOperations.filter((operation) => operation.kind === "other");
  if (unknown.length > 0) {
    const examples = [...new Set(unknown.map((operation) => operation.rawType))].slice(0, 5);
    warnings.push(
      `Nierozpoznane typy operacji (${unknown.length}): ${examples.join(", ")}. Nie wliczono ich do wpłat ani zysku.`,
    );
  }
  if (
    parsed.closedPositions.length === 0 &&
    (kindCounts.purchase || kindCounts.sale) &&
    !kindCounts.profit_loss
  ) {
    warnings.push(
      "Kupna i sprzedaży akcji nie liczymy jako wpłaty ani jako zysk — to obrót kapitałem. Zysk z akcji widać w dywidendach, odsetkach i zamkniętych pozycjach.",
    );
  } else if (parsed.closedPositions.length === 0 && !kindCounts.purchase && !kindCounts.sale) {
    warnings.push(
      "Brak zamkniętych pozycji w pliku. Zysk obejmuje dywidendy, odsetki i inne rozpoznane przepływy wynikowe.",
    );
  }
  if (totalDeposits === 0) {
    warnings.push("Nie znaleziono wpłat. Łączna stopa zwrotu wymaga historii depozytów.");
  }
  if (unrealizedProfit !== 0) {
    warnings.push(
      "Wartość historyczna portfela jest szacowana. Bieżąca wartość otwartych pozycji pochodzi z eksportu.",
    );
  }

  const selectedAccounts = [
    ...new Set([
      ...parsed.cashOperations.map((operation) => operation.accountKind),
      ...parsed.closedPositions.map((position) => position.accountKind),
    ]),
  ] as AccountKind[];

  const metrics = computeMetrics(parsed, firstDate, lastDate);

  return {
    currency: "PLN",
    firstDate,
    lastDate,
    totalDeposits,
    totalWithdrawals,
    netDeposits,
    realizedProfit,
    unrealizedProfit,
    totalProfit,
    portfolioValue,
    totalReturn: totalDeposits > 0 ? totalProfit / totalDeposits : null,
    annualReturn,
    chart,
    warnings,
    cashCount: parsed.cashOperations.length,
    tradeCount: parsed.closedPositions.length,
    kindCounts,
    selectedAccounts,
    metrics,
    accountBreakdown: [],
  };
}
