import { formatDatePl, formatPln, formatSignedPln } from "@/lib/format";
import type { PortfolioReport } from "@/lib/xtb/types";

type PortfolioSummaryProps = {
  report: PortfolioReport;
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

export function PortfolioSummary({ report }: PortfolioSummaryProps) {
  const profitLabel =
    report.totalProfit > 0
      ? `+${formatPln(report.totalProfit)}`
      : formatPln(report.totalProfit);

  const periodLabel =
    report.firstDate && report.lastDate
      ? `od ${formatDatePl(report.firstDate)}`
      : null;

  const accountLabel =
    report.selectedAccounts.length > 0
      ? `${report.selectedAccounts.length} ${report.selectedAccounts.length === 1 ? "konto" : "konta"}`
      : null;

  const subtitle = [profitLabel + " zysku", periodLabel, accountLabel].filter(Boolean).join(" · ");

  return (
    <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-[linear-gradient(135deg,#ffffff_0%,#e8f4fc_48%,#d4ebf9_100%)] p-6 shadow-[0_20px_50px_-28px_rgba(26,111,181,0.45)] sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-positive/10 blur-3xl"
      />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">
            Łączna wartość portfela
          </p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {formatPln(report.portfolioValue)}
          </p>
          <p className={`mt-2 text-base font-medium ${profitTone(report.totalProfit)}`}>{subtitle}</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Aktualna wartość inwestycji dla zaznaczonych kont.
          </p>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-lg">
          <article className="rounded-2xl border border-border/80 bg-surface/90 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Wpłacono łącznie</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {formatPln(report.totalDeposits)}
            </p>
          </article>
          <article className="rounded-2xl border border-border/80 bg-surface/90 px-4 py-3 backdrop-blur-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Wypłacono łącznie</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {formatPln(report.totalWithdrawals)}
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
