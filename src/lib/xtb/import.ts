import type { ParsedXtbFile } from "./types";

/** Plik rozpoznany jako XTB, ale bez operacji ani otwartych pozycji. */
export function isEmptyParsedFile(file: ParsedXtbFile): boolean {
  const hasCashOrTrades =
    file.cashOperations.length > 0 || file.closedPositions.length > 0;
  const hasOpenSummary =
    (file.openProfit != null && file.openProfit !== 0) ||
    (file.openPositionsValue != null && file.openPositionsValue !== 0);
  return !hasCashOrTrades && !hasOpenSummary;
}

export function emptyFileNotice(file: ParsedXtbFile): string {
  const fromParser = file.warnings.find((warning) =>
    warning.includes("nie zawiera operacji"),
  );
  if (fromParser) {
    return `${fromParser} Plik został pominięty.`;
  }
  return `Plik ${file.sourceName} nie zawiera operacji — konto może być puste. Plik został pominięty.`;
}

export function partitionImportedFiles(files: ParsedXtbFile[]): {
  accepted: ParsedXtbFile[];
  skippedEmpty: ParsedXtbFile[];
  rejected: ParsedXtbFile[];
} {
  const accepted: ParsedXtbFile[] = [];
  const skippedEmpty: ParsedXtbFile[] = [];
  const rejected: ParsedXtbFile[] = [];

  for (const file of files) {
    if (isEmptyParsedFile(file)) {
      if (file.recognized) {
        skippedEmpty.push(file);
      } else {
        rejected.push(file);
      }
      continue;
    }
    if (file.recognized || file.cashOperations.length > 0 || file.closedPositions.length > 0) {
      accepted.push(file);
      continue;
    }
    rejected.push(file);
  }

  return { accepted, skippedEmpty, rejected };
}
