import { ACCOUNT_LABELS } from "@/lib/xtb/account";
import { formatPln, formatSignedPln } from "@/lib/format";
import type { AccountBreakdown } from "@/lib/xtb/types";

type AccountBreakdownCardsProps = {
  breakdown: AccountBreakdown[];
};

function profitTone(value: number): string {
  if (value > 0) {
    return "text-positive";
  }
  if (value < 0) {
    return "text-negative";
  }
  return "text-foreground";
}

const ACCOUNT_ACCENT: Record<AccountBreakdown["kind"], string> = {
  standard: "border-l-primary",
  ike: "border-l-positive",
  ikze: "border-l-amber-500",
};

export function AccountBreakdownCards({ breakdown }: AccountBreakdownCardsProps) {
  if (breakdown.length <= 1) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Wartość per konto</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {breakdown.map((entry) => (
          <article
            key={entry.kind}
            className={`rounded-2xl border border-border border-l-4 bg-surface p-4 shadow-[0_10px_30px_-18px_rgba(11,42,74,0.2)] ${ACCOUNT_ACCENT[entry.kind]}`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {ACCOUNT_LABELS[entry.kind]}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{formatPln(entry.portfolioValue)}</p>
            <p className={`mt-1 text-sm font-medium ${profitTone(entry.totalProfit)}`}>
              Zysk: {formatSignedPln(entry.totalProfit)}
            </p>
            <p className="mt-2 text-xs text-muted">
              Wpłacono {formatPln(entry.totalDeposits)} · Wypłacono {formatPln(entry.totalWithdrawals)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
