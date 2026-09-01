export type AccountKind = "standard" | "ike" | "ikze";

export type CashKind =
  | "deposit"
  | "withdrawal"
  | "transfer"
  | "purchase"
  | "sale"
  | "dividend"
  | "stock_split"
  | "withholding_tax"
  | "interest"
  | "interest_tax"
  | "commission"
  | "swap"
  | "profit_loss"
  | "other";

export type CashOperation = {
  id: string;
  kind: CashKind;
  rawType: string;
  time: Date;
  comment: string;
  symbol: string;
  amount: number;
  accountKind: AccountKind;
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
  accountKind: AccountKind;
};

export type ParsedXtbFile = {
  sourceName: string;
  accountKind: AccountKind;
  cashOperations: CashOperation[];
  closedPositions: ClosedPosition[];
  warnings: string[];
  recognized?: boolean;
  openProfit?: number;
  openPositionsValue?: number;
};

export type ChartPoint = {
  time: number;
  label: string;
  /** Kumulatywny kapitał netto: wpłaty − wypłaty. */
  netCapital: number;
  /** Kapitał netto + skumulowany zysk (wartość portfela). */
  equity: number;
};

export type AnalyzeOptions = {
  currentAccountValue?: number;
  treatTransfersAsExternal?: boolean;
};

export type KindCounts = Partial<Record<CashKind, number>>;

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
  /** Kapitał netto + zysk (wartość portfela). */
  portfolioValue: number;
  totalReturn: number | null;
  annualReturn: number | null;
  chart: ChartPoint[];
  warnings: string[];
  cashCount: number;
  tradeCount: number;
  kindCounts: KindCounts;
  selectedAccounts: AccountKind[];
};
