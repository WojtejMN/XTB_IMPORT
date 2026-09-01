import type { CashKind } from "./types";

function normalizeType(rawType: string): string {
  return rawType
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ł/g, "l");
}

export function classifyCashType(rawType: string): CashKind {
  const value = normalizeType(rawType);

  if (!value) {
    return "other";
  }

  if (value.startsWith("deposit") || value.startsWith("wplata")) {
    return "deposit";
  }

  if (value.startsWith("withdrawal") || value.startsWith("wyplata")) {
    return "withdrawal";
  }

  if (value.includes("withholding tax") || value.includes("podatek u zrodla")) {
    return "withholding_tax";
  }

  if (
    value.includes("interest tax") ||
    value.includes("podatek od odsetek")
  ) {
    return "interest_tax";
  }

  if (
    value.includes("free-funds interest") ||
    value.includes("free funds interest") ||
    value.startsWith("interest") ||
    value.includes("odsetki")
  ) {
    return "interest";
  }

  if (value.startsWith("divident") || value.startsWith("dividend") || value.includes("dywidend")) {
    return "dividend";
  }

  if (value.includes("commission") || value.includes("prowizj")) {
    return "commission";
  }

  if (value.includes("swap") || value.includes("overnight")) {
    return "swap";
  }

  return "other";
}

export function isIgnorableRow(rawType: string): boolean {
  const value = normalizeType(rawType);
  return value === "total" || value === "suma" || value === "sum";
}
