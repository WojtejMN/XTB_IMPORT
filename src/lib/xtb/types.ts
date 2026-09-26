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
  openPrice?: number | null;
  commission: number;
  swap: number;
  rollover: number;
  grossProfit: number;
  netProfit: number;
  comment: string;
  accountKind: AccountKind;
};

export type OpenPosition = {
  symbol: string;
  netProfit: number;
  grossProfit?: number;
  value?: number;
  volume?: number | null;
  openTime?: Date | null;
  openPrice?: number | null;
  accountKind: AccountKind;
};

export type ParsedXtbFile = {
  sourceName: string;
  accountKind: AccountKind;
  cashOperations: CashOperation[];
  closedPositions: ClosedPosition[];
  openPositions?: OpenPosition[];
  warnings: string[];
  recognized?: boolean;
  openProfit?: number;
  openPositionsValue?: number;
};

export type ChartPoint = {
  time: number;
  label: string;
  /** Kumulatywny kapitał netto: wpłaty − wypłaty. Ujemny = wypłacono więcej niż wpłacono. */
  netCapital: number;
  /** Wartość portfela: gotówka + wycena pozycji. */
  portfolioValue: number;
  /** Alias `netCapital` dla serii wykresu — bez ucinania do zera. */
  investedCapital: number;
  /** Zysk całkowity: portfolioValue − netCapital (może być ujemny). */
  cumulativeGain: number;
  /** Wpłata w tym punkcie (0 jeśli brak). */
  depositDelta: number;
  /** Wypłata w tym punkcie (0 jeśli brak). */
  withdrawalDelta: number;
};

export type AnalyzeOptions = {
  currentAccountValue?: number;
  treatTransfersAsExternal?: boolean;
};

export type KindCounts = Partial<Record<CashKind, number>>;

export type SymbolProfit = {
  symbol: string;
  profit: number;
  trades: number;
  openPositions: number;
};

export type PositionHighlight = {
  symbol: string;
  profit: number;
};

export type PortfolioMetrics = {
  totalDividends: number;
  totalInterest: number;
  totalWithholdingTax: number;
  totalCommissions: number;
  totalFeesAndTaxes: number;
  internalTransferCount: number;
  winRate: number | null;
  avgHoldingDays: number | null;
  bestPosition: PositionHighlight | null;
  worstPosition: PositionHighlight | null;
  topSymbols: SymbolProfit[];
  investingDays: number | null;
};

export type AccountBreakdown = {
  kind: AccountKind;
  portfolioValue: number;
  totalProfit: number;
  netDeposits: number;
  totalDeposits: number;
  totalWithdrawals: number;
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
  metrics: PortfolioMetrics;
  accountBreakdown: AccountBreakdown[];
};
