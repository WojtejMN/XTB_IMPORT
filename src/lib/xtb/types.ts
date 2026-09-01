export type CashKind =
  | "deposit"
  | "withdrawal"
  | "dividend"
  | "withholding_tax"
  | "interest"
  | "interest_tax"
  | "commission"
  | "swap"
  | "other";

export type CashOperation = {
  id: string;
  kind: CashKind;
  rawType: string;
  time: Date;
  comment: string;
  symbol: string;
  amount: number;
};

export type ClosedPosition = {
  position: string;
  symbol: string;
  type: string;
  volume: number | null;
  openTime: Date | null;
  closeTime: Date;
  commission: number;
  swap: number;
  rollover: number;
  grossProfit: number;
  netProfit: number;
  comment: string;
};

export type ParsedXtbFile = {
  sourceName: string;
  cashOperations: CashOperation[];
  closedPositions: ClosedPosition[];
  warnings: string[];
};

export type ChartPoint = {
  time: number;
  label: string;
  deposits: number;
  profit: number;
};

export type AnalyzeOptions = {
  currentAccountValue?: number;
};

export type PortfolioReport = {
  currency: string;
  firstDate: Date | null;
  lastDate: Date | null;
  totalDeposits: number;
  totalWithdrawals: number;
  netDeposits: number;
  realizedProfit: number;
  unrealizedProfit: number;
  totalProfit: number;
  totalReturn: number | null;
  annualReturn: number | null;
  chart: ChartPoint[];
  warnings: string[];
  cashCount: number;
  tradeCount: number;
};
