import { formatDays, formatPln, formatPct, formatSignedPln } from "@/lib/format";
import type { PortfolioReport } from "@/lib/xtb/types";

type PerformanceIndicatorsProps = {
  report: PortfolioReport;
};

function toneClass(value: number | null): string {
  if (value == null || value === 0) {
    return "text-foreground";
  }
  return value > 0 ? "text-positive" : "text-negative";
}

export function PerformanceIndicators({ report }: PerformanceIndicatorsProps) {
  const { metrics } = report;

  const cards = [
    {
      label: "Dywidendy",
      value: formatPln(metrics.totalDividends),
      hint: "Przychód pasywny",
    },
    {
      label: "Odsetki",
      value: formatPln(metrics.totalInterest),
      hint: "Od wolnych środków",
    },
    {
      label: "Prowizje i opłaty",
      value: formatPln(-metrics.totalFeesAndTaxes),
      hint: `W tym podatki: ${formatPln(metrics.totalWithholdingTax)}`,
      tone: "text-negative",
    },
    {
      label: "Skuteczność pozycji",
      value: metrics.winRate != null ? formatPct(metrics.winRate) : "—",
      hint:
        report.tradeCount > 0
          ? `${report.tradeCount} zamkniętych pozycji`
          : "Brak zamkniętych pozycji",
    },
    {
      label: "Średni czas pozycji",
      value: formatDays(metrics.avgHoldingDays != null ? Math.round(metrics.avgHoldingDays) : null),
      hint: "Od otwarcia do zamknięcia",
    },
    {
      label: "Okres inwestowania",
      value: formatDays(metrics.investingDays),
      hint:
        report.firstDate && report.lastDate
          ? "Od pierwszej do ostatniej operacji"
          : "—",
    },
  ];

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
        Wskaźniki szczegółowe
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-border bg-surface p-4 shadow-[0_10px_30px_-18px_rgba(11,42,74,0.15)]"
          >
            <p className="text-sm font-medium text-muted">{card.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${card.tone ?? "text-foreground"}`}>
              {card.value}
            </p>
            <p className="mt-1 text-xs text-muted">{card.hint}</p>
          </article>
        ))}
      </div>

      {(metrics.bestPosition || metrics.topSymbols.length > 0) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {metrics.bestPosition && metrics.worstPosition ? (
            <article className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold text-foreground">Najlepsza i najgorsza pozycja</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Najlepsza</dt>
                  <dd className={`font-semibold ${toneClass(metrics.bestPosition.profit)}`}>
                    {metrics.bestPosition.symbol}: {formatSignedPln(metrics.bestPosition.profit)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Najgorsza</dt>
                  <dd className={`font-semibold ${toneClass(metrics.worstPosition.profit)}`}>
                    {metrics.worstPosition.symbol}: {formatSignedPln(metrics.worstPosition.profit)}
                  </dd>
                </div>
              </dl>
            </article>
          ) : null}

          {metrics.topSymbols.length > 0 ? (
            <article className="rounded-2xl border border-border bg-surface p-4">
              <h3 className="text-sm font-semibold text-foreground">Top symbole po zysku</h3>
              <ol className="mt-3 space-y-2">
                {metrics.topSymbols.map((entry, index) => (
                  <li key={entry.symbol} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-muted">
                      {index + 1}. {entry.symbol}
                      <span className="ml-1 text-xs">({entry.trades})</span>
                    </span>
                    <span className={`font-semibold ${toneClass(entry.profit)}`}>
                      {formatSignedPln(entry.profit)}
                    </span>
                  </li>
                ))}
              </ol>
            </article>
          ) : null}
        </div>
      )}
    </section>
  );
}
