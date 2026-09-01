import { CASH_KIND_LABELS } from "@/lib/xtb/classify";
import type { CashKind, KindCounts } from "@/lib/xtb/types";

const ORDER: CashKind[] = [
  "deposit",
  "withdrawal",
  "transfer",
  "purchase",
  "sale",
  "dividend",
  "stock_split",
  "interest",
  "interest_tax",
  "withholding_tax",
  "commission",
  "swap",
  "profit_loss",
  "other",
];

type OperationSummaryProps = {
  counts: KindCounts;
};

export function OperationSummary({ counts }: OperationSummaryProps) {
  const items = ORDER.filter((kind) => (counts[kind] ?? 0) > 0);
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((kind) => (
        <li
          key={kind}
          className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted"
        >
          {CASH_KIND_LABELS[kind]}: {counts[kind]}
        </li>
      ))}
    </ul>
  );
}
