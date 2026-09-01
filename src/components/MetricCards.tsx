import { formatPln, formatSignedPct } from "@/lib/format";
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
      label: "Łączna stopa zwrotu",
      value: formatSignedPct(report.totalReturn),
      hint: "Zysk / suma wpłat",
      tone: report.totalReturn,
    },
    {
      label: "Roczna stopa zwrotu",
      value: formatSignedPct(report.annualReturn),
      hint: "XIRR, uwzględnia daty wpłat i wypłat",
      tone: report.annualReturn,
    },
    {
      label: "Suma wpłat",
      value: formatPln(report.totalDeposits),
      hint: report.totalWithdrawals
        ? `Wypłaty: ${formatPln(report.totalWithdrawals)}`
        : "Bez uwzględnienia wypłat",
      tone: null,
    },
    {
      label: "Zysk wyprodukowany",
      value: formatPln(report.totalProfit),
      hint:
        report.unrealizedProfit !== 0
          ? `W tym niezrealizowany: ${formatPln(report.unrealizedProfit)}`
          : "Transakcje + dywidendy + odsetki",
      tone: report.totalProfit,
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
          <p className={`mt-2 text-3xl font-semibold tracking-tight ${toneClass(card.tone)}`}>
            {card.value}
          </p>
          <p className="mt-2 text-sm text-muted">{card.hint}</p>
        </article>
      ))}
    </section>
  );
}
