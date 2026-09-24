import { describe, expect, it } from "vitest";
import { findInternalTransferKeys, isExternalTransfer, operationKey } from "./transfers";
import type { CashOperation } from "../xtb/types";

function op(partial: Partial<CashOperation> & Pick<CashOperation, "id" | "amount" | "accountKind" | "rawType">): CashOperation {
  return {
    kind: "transfer",
    time: partial.time ?? new Date("2025-03-30T10:00:00"),
    comment: partial.comment ?? "",
    symbol: "",
    ...partial,
  };
}

describe("findInternalTransferKeys", () => {
  it("paruje IKE deposit między PLN i IKE", () => {
    const ops = [
      op({
        id: "out",
        amount: -500,
        accountKind: "standard",
        rawType: "IKE deposit",
        time: new Date("2026-01-29T10:00:00"),
      }),
      op({
        id: "in",
        amount: 500,
        accountKind: "ike",
        rawType: "IKE deposit",
        time: new Date("2026-01-29T10:00:01"),
      }),
    ];
    const internal = findInternalTransferKeys(ops);
    expect(internal.size).toBe(2);
    expect(isExternalTransfer(ops[0]!, internal)).toBe(false);
  });

  it("zostawia niesparowany transfer USD jako zewnętrzny", () => {
    const ops = [
      op({
        id: "usd",
        amount: -800,
        accountKind: "standard",
        rawType: "Transfer",
        comment: "Currency conversion, PLN to USD",
        time: new Date("2025-02-20T10:00:00"),
      }),
      op({
        id: "ike-out",
        amount: -200,
        accountKind: "standard",
        rawType: "IKE deposit",
        time: new Date("2025-04-07T10:00:00"),
      }),
      op({
        id: "ike-in",
        amount: 200,
        accountKind: "ike",
        rawType: "IKE deposit",
        time: new Date("2025-04-07T10:00:00"),
      }),
    ];
    const internal = findInternalTransferKeys(ops);
    expect(internal.has(operationKey(ops[0]!))).toBe(false);
    expect(internal.has(operationKey(ops[1]!))).toBe(true);
    expect(internal.has(operationKey(ops[2]!))).toBe(true);
    expect(isExternalTransfer(ops[0]!, internal)).toBe(true);
  });

  it("nie paruje subaccount transfer", () => {
    const ops = [
      op({
        id: "a",
        amount: -200,
        accountKind: "standard",
        rawType: "Subaccount transfer",
      }),
      op({
        id: "b",
        amount: 200,
        accountKind: "standard",
        rawType: "Subaccount transfer",
      }),
    ];
    expect(findInternalTransferKeys(ops).size).toBe(0);
  });
});
