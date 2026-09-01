"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  aggregateChartPoints,
  clampChartRange,
  type ChartGranularity,
} from "@/lib/analysis/chart-series";
import { formatPln } from "@/lib/format";
import type { ChartPoint } from "@/lib/xtb/types";

type PortfolioChartProps = {
  data: ChartPoint[];
};

type ChartMode = "simple" | "advanced";

const GRANULARITY_OPTIONS: { value: ChartGranularity; label: string }[] = [
  { value: "day", label: "Dni" },
  { value: "month", label: "Miesiące" },
  { value: "year", label: "Lata" },
];

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-2 font-medium text-foreground">Data: {label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-muted" style={{ color: entry.color }}>
          {entry.name === "netCapital" ? "Kapitał netto" : "Wartość portfela"}:{" "}
          <span className="font-semibold text-foreground">{formatPln(Number(entry.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

export function PortfolioChart({ data }: PortfolioChartProps) {
  const [mode, setMode] = useState<ChartMode>("simple");
  const [granularity, setGranularity] = useState<ChartGranularity>("month");
  const [brushStart, setBrushStart] = useState(0);
  const [brushEnd, setBrushEnd] = useState(0);

  const series = useMemo(() => {
    if (mode === "advanced") {
      return aggregateChartPoints(data, granularity);
    }
    return aggregateChartPoints(data, "day");
  }, [data, mode, granularity]);

  useEffect(() => {
    const end = Math.max(0, series.length - 1);
    setBrushStart(0);
    setBrushEnd(end);
  }, [series]);

  const { startIndex, endIndex } = clampChartRange(series.length, brushStart, brushEnd);
  const visibleData =
    mode === "advanced" ? series.slice(startIndex, endIndex + 1) : series;
  const isZoomed =
    mode === "advanced" && (startIndex > 0 || endIndex < series.length - 1);
  const chartHeight = mode === "advanced" ? 420 : 360;

  function resetZoom() {
    setBrushStart(0);
    setBrushEnd(Math.max(0, series.length - 1));
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-[0_10px_30px_-18px_rgba(11,42,74,0.25)] sm:p-6">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">Kapitał netto i wartość portfela</h2>
          <p className="max-w-2xl text-sm text-muted">
            {mode === "simple"
              ? "Każdy punkt to ostatni stan danego dnia. Przełącz na tryb zaawansowany, aby przybliżyć zakres i zmienić skalę czasu."
              : "Zmień skalę czasu i precyzyjnie przybliż zakres dat suwakiem poniżej."}
          </p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div
            className="inline-flex rounded-full border border-border bg-background p-1"
            role="group"
            aria-label="Tryb wykresu"
          >
            <button
              type="button"
              aria-pressed={mode === "simple"}
              onClick={() => setMode("simple")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                mode === "simple"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Prosty
            </button>
            <button
              type="button"
              aria-pressed={mode === "advanced"}
              onClick={() => setMode("advanced")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                mode === "advanced"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Zaawansowany
            </button>
          </div>

          {mode === "advanced" ? (
            <div
              className="inline-flex flex-wrap gap-1 rounded-full border border-border bg-background p-1"
              role="group"
              aria-label="Częstotliwość wykresu"
            >
              {GRANULARITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={granularity === option.value}
                  onClick={() => setGranularity(option.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                    granularity === option.value
                      ? "bg-primary-soft text-primary"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {mode === "advanced" ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted sm:text-sm">
          <span>
            {visibleData.length} z {series.length} punktów
            {isZoomed ? " · widok przybliżony" : ""}
          </span>
          {isZoomed ? (
            <button
              type="button"
              onClick={resetZoom}
              className="font-semibold text-primary hover:text-primary-hover"
            >
              Pokaż całą historię
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="w-full" style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={visibleData} margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
            <CartesianGrid stroke="#d7ebf8" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#4d6b85", fontSize: mode === "advanced" ? 11 : 12 }}
              minTickGap={mode === "advanced" ? 18 : 24}
              angle={visibleData.length > 14 ? -24 : 0}
              textAnchor={visibleData.length > 14 ? "end" : "middle"}
              height={visibleData.length > 14 ? 56 : 30}
            />
            <YAxis
              width={72}
              tick={{ fill: "#4d6b85", fontSize: 12 }}
              tickFormatter={(value: number) =>
                new Intl.NumberFormat("pl-PL", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(value)
              }
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              formatter={(value) =>
                value === "netCapital" ? "Kapitał netto (wpłaty − wypłaty)" : "Wartość portfela"
              }
            />
            <Line
              type="stepAfter"
              dataKey="netCapital"
              name="netCapital"
              stroke="#1a6fb5"
              strokeWidth={2.5}
              dot={mode === "advanced" && visibleData.length <= 40 ? { r: 2.5 } : false}
              activeDot={{ r: 5 }}
            />
            <Line
              type="stepAfter"
              dataKey="portfolioValue"
              name="portfolioValue"
              stroke="#0d7a62"
              strokeWidth={2.5}
              dot={mode === "advanced" && visibleData.length <= 40 ? { r: 2.5 } : false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {mode === "advanced" && series.length > 1 ? (
        <div className="mt-4 h-16 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
              <XAxis dataKey="label" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line type="stepAfter" dataKey="portfolioValue" stroke="#0d7a62" strokeWidth={1} dot={false} />
              <Brush
                dataKey="label"
                height={28}
                stroke="#1a6fb5"
                fill="#e8f4fc"
                travellerWidth={10}
                startIndex={startIndex}
                endIndex={endIndex}
                onChange={(range) => {
                  if (range.startIndex == null || range.endIndex == null) {
                    return;
                  }
                  const next = clampChartRange(series.length, range.startIndex, range.endIndex);
                  setBrushStart(next.startIndex);
                  setBrushEnd(next.endIndex);
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </section>
  );
}
