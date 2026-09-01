import type { CashKind } from "./types";

export function normalizeType(rawType: string): string {
  return rawType
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l");
}

const RULES: { kind: CashKind; match: (value: string) => boolean }[] = [
  {
    kind: "withholding_tax",
    match: (value) =>
      value.includes("withholding tax") ||
      value.includes("podatek u zrodla") ||
      value.includes("dividend tax") ||
      value.includes("tax from dividend") ||
      value.includes("podatek od dywidend") ||
      value === "ike tax" ||
      value === "ikze tax" ||
      value.endsWith(" ike tax") ||
      value.endsWith(" ikze tax"),
  },
  {
    kind: "interest_tax",
    match: (value) =>
      value.includes("interest tax") ||
      value.includes("podatek od odsetek") ||
      value.includes("free-funds interest tax") ||
      value.includes("free funds interest tax") ||
      value.includes("free funds interests tax"),
  },
  {
    kind: "commission",
    match: (value) =>
      value.includes("commission") ||
      value.includes("prowizj") ||
      value.includes("sec fee") ||
      value.includes("stamp duty") ||
      value.includes("podatek od czynności") ||
      value.includes("stamp"),
  },
  {
    kind: "stock_split",
    match: (value) =>
      value.includes("stock split") ||
      value.includes("split") ||
      value.includes("rownowaz") ||
      value.includes("equalization") ||
      value.includes("consolidation") ||
      value.includes("reverse split"),
  },
  {
    kind: "purchase",
    match: (value) =>
      value.includes("stocks/etf purchase") ||
      value.includes("stock/etf purchase") ||
      value.includes("purchase") ||
      value.includes("kupno") ||
      value.includes("acoes/etf compra") ||
      (value.includes("buy") && (value.includes("stock") || value.includes("etf") || value.includes("akcj"))),
  },
  {
    kind: "sale",
    match: (value) =>
      value.includes("stocks/etf sale") ||
      value.includes("stock/etf sale") ||
      value.includes("stock sell") ||
      value.includes("stocks sell") ||
      value.includes("sprzedaz") ||
      value.includes("acoes/etf vende") ||
      (value.includes("sale") && !value.includes("wholesale")) ||
      (value.includes("sell") && (value.includes("stock") || value.includes("etf") || value.includes("akcj"))),
  },
  {
    kind: "transfer",
    match: (value) =>
      value.includes("transfer") ||
      value.includes("przelew") ||
      value.includes("przenies") ||
      value.includes("ike deposit") ||
      value.includes("ikze deposit") ||
      value.includes("ike return") ||
      value.includes("ikze return") ||
      value.includes("wplata ike") ||
      value.includes("wplata ikze"),
  },
  {
    kind: "deposit",
    match: (value) => value.startsWith("deposit") || value.startsWith("wplata"),
  },
  {
    kind: "withdrawal",
    match: (value) => value.startsWith("withdrawal") || value.startsWith("wyplata"),
  },
  {
    kind: "dividend",
    match: (value) =>
      value.includes("divident") ||
      value.includes("dividend") ||
      value.includes("dywidend") ||
      value.includes("spin off") ||
      value.includes("spin-off"),
  },
  {
    kind: "interest",
    match: (value) =>
      value.includes("free-funds interest") ||
      value.includes("free funds interest") ||
      value.includes("odsetki") ||
      value.startsWith("interest"),
  },
  {
    kind: "swap",
    match: (value) => value.includes("swap") || value.includes("overnight"),
  },
  {
    kind: "profit_loss",
    match: (value) =>
      value.includes("profit/loss") ||
      value.includes("profit & loss") ||
      value.includes("zysk/strata") ||
      value.includes("wynik zamkniecia") ||
      value.includes("close trade") ||
      value.includes("zamkniecie transakcji") ||
      value.includes("zamkniecie pozycji"),
  },
];

export function classifyCashType(rawType: string): CashKind {
  const value = normalizeType(rawType);
  if (!value) {
    return "other";
  }
  const rule = RULES.find((entry) => entry.match(value));
  return rule?.kind ?? "other";
}

export function isIgnorableRow(rawType: string): boolean {
  const value = normalizeType(rawType);
  return value === "total" || value === "suma" || value === "sum";
}

export function isFooterLabel(value: string): boolean {
  const normalized = normalizeType(value);
  return (
    isIgnorableRow(normalized) ||
    normalized === "profit/loss" ||
    normalized === "profit loss" ||
    normalized === "note"
  );
}

export function isSubaccountTransfer(rawType: string): boolean {
  return normalizeType(rawType).includes("subaccount");
}

export function duplicatesClosedPositionPnl(kind: CashKind): boolean {
  return kind === "profit_loss" || kind === "swap";
}

export function isProfitKind(kind: CashKind): boolean {
  return (
    kind === "dividend" ||
    kind === "withholding_tax" ||
    kind === "interest" ||
    kind === "interest_tax" ||
    kind === "commission" ||
    kind === "swap" ||
    kind === "profit_loss"
  );
}

export const CASH_KIND_LABELS: Record<CashKind, string> = {
  deposit: "Wpłaty",
  withdrawal: "Wypłaty",
  transfer: "Transfery",
  purchase: "Kupna",
  sale: "Sprzedaże",
  dividend: "Dywidendy",
  stock_split: "Równoważenia / splity",
  withholding_tax: "Podatek u źródła",
  interest: "Odsetki",
  interest_tax: "Podatek od odsetek",
  commission: "Prowizje",
  swap: "Swap",
  profit_loss: "Wynik zamknięcia",
  other: "Inne",
};
