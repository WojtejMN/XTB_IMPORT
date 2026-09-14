import { isSubaccountTransfer } from "../xtb/classify";
import type { CashOperation } from "../xtb/types";

const AMOUNT_EPS = 0.01;
/** Maksymalna różnica czasu między nogami transferu wewnętrznego. */
const PAIR_WINDOW_MS = 1000 * 60 * 60 * 36;

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isPairableTransfer(operation: CashOperation): boolean {
  return operation.kind === "transfer" && !isSubaccountTransfer(operation.rawType);
}

/**
 * Oznacza transfery, które mają przeciwną nogę w tym samym zestawie kont
 * (np. IKE deposit −500 na PLN i +500 na IKE). Takie pary to ruch wewnętrzny.
 */
export function findInternalTransferKeys(operations: CashOperation[]): Set<string> {
  const candidates = operations
    .filter(isPairableTransfer)
    .map((operation, index) => ({ operation, index }))
    .sort((a, b) => a.operation.time.getTime() - b.operation.time.getTime());

  const used = new Set<number>();
  const internalKeys = new Set<string>();

  for (let i = 0; i < candidates.length; i += 1) {
    if (used.has(i)) {
      continue;
    }
    const left = candidates[i]!;
    for (let j = i + 1; j < candidates.length; j += 1) {
      if (used.has(j)) {
        continue;
      }
      const right = candidates[j]!;
      const timeDelta = Math.abs(right.operation.time.getTime() - left.operation.time.getTime());
      if (timeDelta > PAIR_WINDOW_MS) {
        break;
      }
      if (left.operation.accountKind === right.operation.accountKind) {
        continue;
      }
      if (Math.sign(left.operation.amount) === Math.sign(right.operation.amount)) {
        continue;
      }
      if (Math.abs(Math.abs(left.operation.amount) - Math.abs(right.operation.amount)) > AMOUNT_EPS) {
        continue;
      }

      used.add(i);
      used.add(j);
      internalKeys.add(operationKey(left.operation));
      internalKeys.add(operationKey(right.operation));
      break;
    }
  }

  return internalKeys;
}

export function operationKey(operation: CashOperation): string {
  return [
    operation.accountKind,
    operation.id,
    operation.time.getTime(),
    operation.amount,
    operation.rawType,
  ].join("|");
}

export function isExternalTransfer(
  operation: CashOperation,
  internalKeys: Set<string>,
): boolean {
  return isPairableTransfer(operation) && !internalKeys.has(operationKey(operation));
}

export function transferDayHint(operation: CashOperation): string {
  return dayKey(operation.time);
}
