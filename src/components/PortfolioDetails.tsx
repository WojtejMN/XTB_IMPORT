import { formatPln, formatSignedPln } from "@/lib/format";
import type { PortfolioReport } from "@/lib/xtb/types";

type PortfolioDetailsProps = {
  report: PortfolioReport;
};

export function PortfolioDetails({ report }: PortfolioDetailsProps) {
  const flowBalance = report.netDeposits;
  const flowDescription =
    flowBalance < 0
      ? `Wypłacono o ${formatPln(Math.abs(flowBalance))} więcej niż wpłacono`
      : flowBalance > 0
        ? "Kapitał netto pozostawiony na koncie"
        : "Wpłaty i wypłaty się równoważą";

  return (
    <details className="group rounded-2xl border border-border bg-surface">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          Szczegóły przepływów i wyniku
          <span className="text-xs font-medium text-muted transition group-open:rotate-180">▼</span>
        </span>
      </summary>
      <div className="border-t border-border px-5 py-4">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Saldo przepływów</dt>
            <dd className="mt-1 text-lg font-semibold text-foreground">{formatSignedPln(flowBalance)}</dd>
            <dd className="mt-0.5 text-xs text-muted">{flowDescription}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Zysk zrealizowany</dt>
            <dd className="mt-1 text-lg font-semibold text-foreground">{formatPln(report.realizedProfit)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Zysk niezrealizowany</dt>
            <dd className="mt-1 text-lg font-semibold text-foreground">{formatPln(report.unrealizedProfit)}</dd>
          </div>
          {report.metrics.internalTransferCount > 0 ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">Transfery wewnętrzne</dt>
              <dd className="mt-1 text-lg font-semibold text-foreground">
                {report.metrics.internalTransferCount}
              </dd>
              <dd className="mt-0.5 text-xs text-muted">Nie liczone jako wpłaty ani wypłaty</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </details>
  );
}
