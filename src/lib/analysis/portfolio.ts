import { xirr, type CashFlow } from "./xirr";
import type {
  AnalyzeOptions,
  CashOperation,
  ChartPoint,
  ParsedXtbFile,
  PortfolioReport,
} from "../xtb/types";

type TimelineEvent = {
  time: Date;
  depositDelta: number;
  withdrawalDelta: number;
  profitDelta: number;
};

function signedCashAmount(operation: CashOperation): number {
  if (operation.kind === "deposit") {
    return Math.abs(operation.amount);
  }
  if (operation.kind === "withdrawal") {
    return -Math.abs(operation.amount);
  }
  return operation.amount;
}

function isProfitCash(kind: CashOperation["kind"]): boolean {
  return (
    kind === "dividend" ||
    kind === "withholding_tax" ||
    kind === "interest" ||
    kind === "interest_tax" ||
    kind === "commission" ||
    kind === "swap" ||
    kind === "other"
  );
}

function buildEvents(parsed: ParsedXtbFile): TimelineEvent[] {
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

    if (isProfitCash(operation.kind)) {
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

function formatChartLabel(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function buildChart(events: TimelineEvent[]): ChartPoint[] {
  let deposits = 0;
  let profit = 0;
  const points: ChartPoint[] = [];

  if (events.length === 0) {
    return points;
  }

  points.push({
    time: events[0].time.getTime() - 1,
    label: formatChartLabel(events[0].time),
    deposits: 0,
    profit: 0,
  });

  for (const event of events) {
    deposits += event.depositDelta;
    profit += event.profitDelta;
    const last = points[points.length - 1];
    if (last && last.time === event.time.getTime()) {
      last.deposits = deposits;
      last.profit = profit;
      continue;
    }
    points.push({
      time: event.time.getTime(),
      label: formatChartLabel(event.time),
      deposits,
      profit,
    });
  }

  return points;
}

function investorCashFlows(
  cashOperations: CashOperation[],
  terminalDate: Date,
  terminalValue: number,
): CashFlow[] {
  const flows: CashFlow[] = cashOperations
    .filter((operation) => operation.kind === "deposit" || operation.kind === "withdrawal")
    .map((operation) => ({
      date: operation.time,
      amount: signedCashAmount(operation) * -1,
    }));

  flows.push({ date: terminalDate, amount: terminalValue });
  return flows;
}

export function analyzePortfolio(
  parsed: ParsedXtbFile,
  options: AnalyzeOptions = {},
): PortfolioReport {
  const events = buildEvents(parsed);
  const totalDeposits = events.reduce((sum, event) => sum + event.depositDelta, 0);
  const totalWithdrawals = events.reduce((sum, event) => sum + event.withdrawalDelta, 0);
  const realizedProfit = events.reduce((sum, event) => sum + event.profitDelta, 0);
  const netDeposits = totalDeposits - totalWithdrawals;

  const estimatedEquity = netDeposits + realizedProfit;
  const currentValue = options.currentAccountValue;
  const hasCurrentValue = currentValue != null && Number.isFinite(currentValue);
  const unrealizedProfit = hasCurrentValue ? currentValue - estimatedEquity : 0;
  const totalProfit = hasCurrentValue ? currentValue - netDeposits : realizedProfit;

  const dates = events.map((event) => event.time);
  const firstDate = dates[0] ?? null;
  const lastEventDate = dates[dates.length - 1] ?? null;
  const lastDate = hasCurrentValue ? new Date() : lastEventDate;

  const chart = buildChart(events);
  if (hasCurrentValue && lastDate && chart.length > 0) {
    chart.push({
      time: lastDate.getTime(),
      label: formatChartLabel(lastDate),
      deposits: totalDeposits,
      profit: totalProfit,
    });
  }

  const terminalValue = hasCurrentValue ? currentValue : estimatedEquity;
  const terminalForXirr = lastDate ?? new Date();
  const annualReturn =
    firstDate && lastDate
      ? xirr(investorCashFlows(parsed.cashOperations, terminalForXirr, terminalValue))
      : null;

  const warnings = [...parsed.warnings];
  if (parsed.closedPositions.length === 0) {
    warnings.push(
      "Brak zamkniętych pozycji w pliku. Zysk obejmuje tylko operacje kasowe (dywidendy, odsetki, prowizje).",
    );
  }
  if (totalDeposits === 0) {
    warnings.push("Nie znaleziono wpłat. Łączna stopa zwrotu wymaga historii depozytów.");
  }

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
    totalReturn: totalDeposits > 0 ? totalProfit / totalDeposits : null,
    annualReturn,
    chart,
    warnings,
    cashCount: parsed.cashOperations.length,
    tradeCount: parsed.closedPositions.length,
  };
}

