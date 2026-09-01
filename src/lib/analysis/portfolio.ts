import { duplicatesClosedPositionPnl, isProfitKind, isSubaccountTransfer } from "../xtb/classify";
import type {
  AccountKind,
  AnalyzeOptions,
  CashOperation,
  ChartPoint,
  KindCounts,
  ParsedXtbFile,
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

function buildChart(events: TimelineEvent[]): ChartPoint[] {
  let deposits = 0;
  let withdrawals = 0;
  let profit = 0;
  const points: ChartPoint[] = [];

  if (events.length === 0) {
    return points;
  }

  points.push({
    time: events[0].time.getTime() - 1,
    label: formatChartLabel(events[0].time),
    netCapital: 0,
    equity: 0,
  });

  for (const event of events) {
    deposits += event.depositDelta;
    withdrawals += event.withdrawalDelta;
    profit += event.profitDelta;
    const netCapital = deposits - withdrawals;
    const equity = netCapital + profit;
    const last = points[points.length - 1];
    if (last && last.time === event.time.getTime()) {
      last.netCapital = netCapital;
      last.equity = equity;
      continue;
    }
    points.push({
      time: event.time.getTime(),
      label: formatChartLabel(event.time),
      netCapital,
      equity,
    });
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

  const dates = events.map((event) => event.time);
  const firstDate = dates[0] ?? null;
  const lastEventDate = dates[dates.length - 1] ?? null;
  const lastDate = hasCurrentValue ? new Date() : lastEventDate;

  const chart = buildChart(events);
  if (hasCurrentValue && lastDate && chart.length > 0) {
    chart.push({
      time: lastDate.getTime(),
      label: formatChartLabel(lastDate),
      netCapital: netDeposits,
      equity: currentValue,
    });
  } else if (hasOpenProfit && chart.length > 0) {
    const last = chart[chart.length - 1];
    last.equity = netDeposits + totalProfit;
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

  const selectedAccounts = [
    ...new Set([
      ...parsed.cashOperations.map((operation) => operation.accountKind),
      ...parsed.closedPositions.map((position) => position.accountKind),
    ]),
  ] as AccountKind[];

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
    kindCounts,
    selectedAccounts,
  };
}
