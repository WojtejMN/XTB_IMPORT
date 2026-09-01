import type { AccountKind, ParsedXtbFile } from "./types";

function operationKey(fileName: string, id: string, time: number, amount: number, rawType: string): string {
  return `${fileName}|${id}|${time}|${amount}|${rawType}`;
}

export function mergeParsedFiles(
  files: ParsedXtbFile[],
  selected: AccountKind[],
): ParsedXtbFile {
  const allowed = new Set(selected);
  const warnings: string[] = [];
  const cashKeys = new Set<string>();
  const tradeKeys = new Set<string>();
  const merged: ParsedXtbFile = {
    sourceName: files.map((file) => file.sourceName).join(", "),
    accountKind: selected[0] ?? "standard",
    cashOperations: [],
    closedPositions: [],
    warnings,
    recognized: false,
    openProfit: undefined,
    openPositionsValue: undefined,
  };

  let openProfit = 0;
  let openPositionsValue = 0;
  let sawOpenSummary = false;

  for (const file of files) {
    if (!allowed.has(file.accountKind)) {
      continue;
    }
    warnings.push(...file.warnings);
    merged.recognized = Boolean(merged.recognized || file.recognized);
    if (file.openProfit != null || file.openPositionsValue != null) {
      sawOpenSummary = true;
      openProfit += file.openProfit ?? 0;
      openPositionsValue += file.openPositionsValue ?? 0;
    }
    for (const operation of file.cashOperations) {
      const key = operationKey(
        file.sourceName,
        operation.id,
        operation.time.getTime(),
        operation.amount,
        operation.rawType,
      );
      if (cashKeys.has(key)) {
        continue;
      }
      cashKeys.add(key);
      merged.cashOperations.push(operation);
    }
    for (const position of file.closedPositions) {
      const key = `${file.sourceName}|${position.position}|${position.closeTime.getTime()}|${position.netProfit}`;
      if (tradeKeys.has(key)) {
        continue;
      }
      tradeKeys.add(key);
      merged.closedPositions.push(position);
    }
  }

  merged.cashOperations.sort((a, b) => a.time.getTime() - b.time.getTime());
  merged.closedPositions.sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
  if (sawOpenSummary) {
    merged.openProfit = openProfit;
    merged.openPositionsValue = openPositionsValue;
  }
  return merged;
}
