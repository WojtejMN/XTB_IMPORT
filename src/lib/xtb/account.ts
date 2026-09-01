import type { AccountKind, ParsedXtbFile } from "./types";

export const ACCOUNT_LABELS: Record<AccountKind, string> = {
  standard: "Portfel zwykły",
  ike: "IKE",
  ikze: "IKZE",
};

export const ALL_ACCOUNT_KINDS: AccountKind[] = ["standard", "ike", "ikze"];

export function detectAccountKind(sourceName: string, preview = ""): AccountKind {
  const haystack = `${sourceName} ${preview}`.toLowerCase();
  if (haystack.includes("ikze")) {
    return "ikze";
  }
  if (/(^|[^a-z])ike([^a-z]|$)/i.test(haystack) || haystack.includes("indywidualne konto emerytalne")) {
    return "ike";
  }
  return "standard";
}

export function stampAccountKind(file: ParsedXtbFile, accountKind: AccountKind): ParsedXtbFile {
  return {
    ...file,
    accountKind,
    cashOperations: file.cashOperations.map((operation) => ({ ...operation, accountKind })),
    closedPositions: file.closedPositions.map((position) => ({ ...position, accountKind })),
  };
}

export function previewFromRows(rows: unknown[][]): string {
  return rows
    .slice(0, 12)
    .map((row) => row.map((cell) => String(cell ?? "")).join(" "))
    .join(" ");
}
