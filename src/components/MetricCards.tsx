import { formatPln, formatSignedPct } from "@/lib/format";
import type { PortfolioReport } from "@/lib/xtb/types";

type MetricCardsProps = {
  report: PortfolioReport;
};

function toneClass(value: number | null): string {
  if (value == null || value === 0) {
    return "text-stone-900";
  }
  return value > 0 ? "text-teal-800" : "text-rose-800";
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
          className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
        >
          <p className="text-sm font-medium text-stone-600">{card.label}</p>
          <p className={`mt-2 text-3xl font-semibold tracking-tight ${toneClass(card.tone)}`}>
            {card.value}
          </p>
          <p className="mt-2 text-sm text-stone-500">{card.hint}</p>
        </article>
      ))}
    </section>
  );
}
