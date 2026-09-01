export type CashFlow = {
  date: Date;
  amount: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function yearFraction(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (365 * MS_PER_DAY);
}

function npv(rate: number, flows: { t: number; amount: number }[]): number {
  return flows.reduce((sum, flow) => sum + flow.amount / (1 + rate) ** flow.t, 0);
}

export function xirr(cashFlows: CashFlow[]): number | null {
  const valid = cashFlows
    .filter((flow) => Number.isFinite(flow.amount) && !Number.isNaN(flow.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (valid.length < 2) {
    return null;
  }

  const hasPositive = valid.some((flow) => flow.amount > 0);
  const hasNegative = valid.some((flow) => flow.amount < 0);
  if (!hasPositive || !hasNegative) {
    return null;
  }

  const start = valid[0].date;
  const timed = valid.map((flow) => ({
    t: yearFraction(start, flow.date),
    amount: flow.amount,
  }));

  let low = -0.999999;
  let high = 1;
  let fLow = npv(low, timed);
  let fHigh = npv(high, timed);

  for (let expand = 0; expand < 40 && fLow * fHigh > 0; expand += 1) {
    high = high * 2 + 1;
    fHigh = npv(high, timed);
    if (high > 10_000) {
      return null;
    }
  }

  if (fLow * fHigh > 0) {
    return null;
  }

  let mid = 0;
  for (let iteration = 0; iteration < 120; iteration += 1) {
    mid = (low + high) / 2;
    const fMid = npv(mid, timed);
    if (Math.abs(fMid) < 1e-10) {
      return mid;
    }
    if (fLow * fMid < 0) {
      high = mid;
      fHigh = fMid;
    } else {
      low = mid;
      fLow = fMid;
    }
  }

  return mid;
}
