import { formatPln, formatSignedPct, formatSignedPln } from "@/lib/format";
import type { PortfolioReport } from "@/lib/xtb/types";

type MetricCardsProps = {
  report: PortfolioReport;
};

function toneClass(value: number | null): string {
  if (value == null || value === 0) {
    return "text-foreground";
  }
  return value > 0 ? "text-positive" : "text-negative";
}

export function MetricCards({ report }: MetricCardsProps) {
  const cards = [
    {
      label: "Zysk wyprodukowany",
      value: formatSignedPln(report.totalProfit),
      hint:
        report.unrealizedProfit !== 0
          ? `Zrealizowany: ${formatPln(report.realizedProfit)} · Niezrealizowany: ${formatPln(report.unrealizedProfit)}`
          : "Dywidendy, odsetki i zamknięte pozycje",
      toneClass: toneClass(report.totalProfit),
    },
    {
      label: "Łączna stopa zwrotu",
      value: formatSignedPct(report.totalReturn),
      hint: "Zysk / suma wpłat",
      toneClass: toneClass(report.totalReturn),
    },
    {
      label: "Roczna stopa zwrotu",
      value: formatSignedPct(report.annualReturn),
      hint: "XIRR — uwzględnia daty wpłat i wypłat",
      toneClass: toneClass(report.annualReturn),
    },
    {
      label: "Saldo przepływów",
      value: formatSignedPln(report.netDeposits),
      hint:
        report.netDeposits < 0
          ? "Wypłacono więcej niż wpłacono"
          : `Wpłaty: ${formatPln(report.totalDeposits)} · Wypłaty: ${formatPln(report.totalWithdrawals)}`,
      toneClass: "text-foreground",
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-2xl border border-border bg-surface p-5 shadow-[0_10px_30px_-18px_rgba(11,42,74,0.25)]"
        >
          <p className="text-sm font-medium text-muted">{card.label}</p>
          <p className={`mt-2 text-3xl font-semibold tracking-tight ${card.toneClass}`}>
            {card.value}
          </p>
          <p className="mt-2 text-sm text-muted">{card.hint}</p>
        </article>
      ))}
    </section>
  );
}
