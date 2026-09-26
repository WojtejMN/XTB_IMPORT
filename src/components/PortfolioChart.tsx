"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
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
import { ACCOUNT_LABELS } from "@/lib/xtb/account";
import { formatPln } from "@/lib/format";
import type { AccountKind, ChartPoint } from "@/lib/xtb/types";

type PortfolioChartProps = {
  data: ChartPoint[];
  perAccount?: Partial<Record<AccountKind, ChartPoint[]>>;
  selectedAccounts: AccountKind[];
  availableAccounts: AccountKind[];
  onSelectedAccountsChange: (accounts: AccountKind[]) => void;
  /** Gdy true — interpolacja liniowa (dzienne MTM), inaczej schodki transakcyjne. */
  marketMarked?: boolean;
};

type ChartMode = "simple" | "advanced";
type DataView = "value" | "profit" | "flows";

const GRANULARITY_OPTIONS: { value: ChartGranularity; label: string }[] = [
  { value: "day", label: "Dni" },
  { value: "month", label: "Miesiące" },
  { value: "year", label: "Lata" },
];

const DATA_VIEW_OPTIONS: { value: DataView; label: string }[] = [
  { value: "value", label: "Wartość" },
  { value: "profit", label: "Zysk" },
  { value: "flows", label: "Przepływy" },
];

const ACCOUNT_COLORS: Record<AccountKind, string> = {
  standard: "#1a6fb5",
  ike: "#0d7a62",
  ikze: "#c47d0e",
};

const ACCOUNT_ORDER: AccountKind[] = ["standard", "ike", "ikze"];

const VALUE_COLOR = "#0d7a62";
/** Neutralny grafit — niebieski jest już zajęty przez linię portfela zwykłego. */
const CAPITAL_COLOR = "#475569";
const DEPOSIT_COLOR = "#1a6fb5";
const WITHDRAWAL_COLOR = "#c0392b";
const BASELINE_COLOR = "#94a3b8";

const SERIES_LABELS: Record<string, string> = {
  portfolioValue: "Wartość portfela",
  netCapital: "Wpłacony kapitał netto",
  cumulativeGain: "Zysk / strata całkowita",
  cumulativeGainLine: "Zysk / strata całkowita",
  depositDelta: "Wpłaty",
  withdrawalDelta: "Wypłaty",
  standard: ACCOUNT_LABELS.standard,
  ike: ACCOUNT_LABELS.ike,
  ikze: ACCOUNT_LABELS.ikze,
};

/** Oś Y musi zejść poniżej zera, gdy kapitał netto jest ujemny. */
function axisLowerBound(dataMin: number): number {
  if (!Number.isFinite(dataMin)) {
    return 0;
  }
  return Math.min(0, Math.floor(dataMin * 1.05));
}

type ChartRow = ChartPoint & Record<string, number | string | Partial<Record<AccountKind, number>> | undefined>;

function mergePerAccountSeries(
  base: ChartPoint[],
  perAccount: Partial<Record<AccountKind, ChartPoint[]>>,
  kinds: AccountKind[],
): ChartRow[] {
  if (kinds.length === 0) {
    return base;
  }
  return base.map((point) => {
    const row: ChartRow = { ...point };
    for (const kind of kinds) {
      const series = perAccount[kind];
      if (!series) {
        continue;
      }
      const match = series.reduce<ChartPoint | null>((best, entry) => {
        if (entry.time <= point.time && (!best || entry.time > best.time)) {
          return entry;
        }
        return best;
      }, null);
      if (match) {
        row[`account_${kind}`] = match.portfolioValue;
      }
    }
    return row;
  });
}

function TooltipRow({
  name,
  value,
  color,
  hint,
  emphasized = false,
}: {
  name: string;
  value: number;
  color: string;
  hint?: string;
  emphasized?: boolean;
}) {
  return (
    <p className="text-muted" style={{ color }}>
      {name}:{" "}
      <span
        className={`font-semibold ${
          emphasized ? (value < 0 ? "text-negative" : "text-positive") : "text-foreground"
        }`}
      >
        {formatPln(value)}
      </span>
      {hint ? <span className="ml-1 text-xs">{hint}</span> : null}
    </p>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  dataView,
}: {
  active?: boolean;
  payload?: {
    name?: string;
    value?: number;
    color?: string;
    dataKey?: string;
    payload?: ChartRow;
  }[];
  label?: string;
  dataView: DataView;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const row = payload[0]?.payload;

  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-2 font-medium text-foreground">Data: {label}</p>

      {dataView === "value" && row ? (
        <>
          <TooltipRow name="Wartość portfela" value={row.portfolioValue} color={VALUE_COLOR} />
          <TooltipRow
            name="Kapitał netto (wpłaty − wypłaty)"
            value={row.netCapital}
            color={CAPITAL_COLOR}
            hint={row.netCapital < 0 ? "(wypłacono więcej niż wpłacono)" : undefined}
          />
          <TooltipRow
            name={row.portfolioValue - row.netCapital < 0 ? "Strata całkowita" : "Zysk całkowity"}
            value={row.portfolioValue - row.netCapital}
            color={VALUE_COLOR}
            emphasized
          />
          {ACCOUNT_ORDER.map((kind) => {
            const accountValue = row[`account_${kind}`];
            if (typeof accountValue !== "number") {
              return null;
            }
            return (
              <TooltipRow
                key={kind}
                name={ACCOUNT_LABELS[kind]}
                value={accountValue}
                color={ACCOUNT_COLORS[kind]}
              />
            );
          })}
        </>
      ) : null}

      {dataView === "profit" && row ? (
        <TooltipRow
          name={row.cumulativeGain < 0 ? "Strata całkowita" : "Zysk całkowity"}
          value={row.cumulativeGain}
          color={VALUE_COLOR}
          emphasized
        />
      ) : null}

      {dataView === "flows" && row ? (
        <>
          {row.depositDelta > 0 ? (
            <TooltipRow name="Wpłata" value={row.depositDelta} color={DEPOSIT_COLOR} />
          ) : null}
          {row.withdrawalDelta > 0 ? (
            <TooltipRow name="Wypłata" value={row.withdrawalDelta} color={WITHDRAWAL_COLOR} />
          ) : null}
          {row.depositDelta === 0 && row.withdrawalDelta === 0 ? (
            <p className="text-muted">Brak przepływów w tym okresie.</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function PortfolioChart({
  data,
  perAccount,
  selectedAccounts,
  availableAccounts,
  onSelectedAccountsChange,
  marketMarked = false,
}: PortfolioChartProps) {
  const [mode, setMode] = useState<ChartMode>("simple");
  const [granularity, setGranularity] = useState<ChartGranularity>("month");
  const [dataView, setDataView] = useState<DataView>("value");
  const [brushStart, setBrushStart] = useState(0);
  const [brushEnd, setBrushEnd] = useState(0);

  const curveType = marketMarked ? "linear" : "stepAfter";

  const overlayKey = selectedAccounts.length > 1 ? selectedAccounts.slice().sort().join(",") : "";
  const overlayAccounts = selectedAccounts.length > 1 ? selectedAccounts : [];

  const enriched = useMemo(
    () => mergePerAccountSeries(data, perAccount ?? {}, overlayAccounts),
    [data, perAccount, overlayKey],
  );

  const series = useMemo(() => {
    const granularityLevel = mode === "advanced" ? granularity : "day";
    return aggregateChartPoints(enriched, granularityLevel) as ChartRow[];
  }, [enriched, mode, granularity]);

  useEffect(() => {
    const end = Math.max(0, series.length - 1);
    setBrushStart(0);
    setBrushEnd(end);
  }, [series, overlayKey]);

  const { startIndex, endIndex } = clampChartRange(series.length, brushStart, brushEnd);
  const visibleData = mode === "advanced" ? series.slice(startIndex, endIndex + 1) : series;
  const isZoomed = mode === "advanced" && (startIndex > 0 || endIndex < series.length - 1);
  const chartHeight = mode === "advanced" ? 420 : 380;

  const flowMarkers = useMemo(
    () =>
      visibleData.filter((point) => point.depositDelta > 0 || point.withdrawalDelta > 0),
    [visibleData],
  );

  function toggleAccount(kind: AccountKind) {
    if (selectedAccounts.includes(kind)) {
      if (selectedAccounts.length === 1) {
        return;
      }
      onSelectedAccountsChange(selectedAccounts.filter((entry) => entry !== kind));
      return;
    }
    onSelectedAccountsChange([...selectedAccounts, kind]);
  }

  function resetZoom() {
    setBrushStart(0);
    setBrushEnd(Math.max(0, series.length - 1));
  }

  const description =
    dataView === "value"
      ? marketMarked
        ? "Wartość portfela (gotówka + akcje × kurs zamknięcia) na tle wpłaconego kapitału netto."
        : "Wartość portfela na tle wpłaconego kapitału netto (linia przerywana). Serie nie są na sobie układane."
      : dataView === "profit"
        ? "Zysk / strata całkowita względem zera: wartość portfela − kapitał netto."
        : "Wpłaty i wypłaty jako słupki w poszczególnych okresach.";

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-[0_10px_30px_-18px_rgba(11,42,74,0.25)] sm:p-6">
      <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-foreground">Wykres portfela</h2>
          <p className="max-w-2xl text-sm text-muted">{description}</p>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <div
            className="inline-flex rounded-full border border-border bg-background p-1"
            role="group"
            aria-label="Tryb wykresu"
          >
            {(["simple", "advanced"] as ChartMode[]).map((entry) => (
              <button
                key={entry}
                type="button"
                aria-pressed={mode === entry}
                onClick={() => setMode(entry)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  mode === entry
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {entry === "simple" ? "Prosty" : "Zaawansowany"}
              </button>
            ))}
          </div>

          <div
            className="inline-flex flex-wrap gap-1 rounded-full border border-border bg-background p-1"
            role="group"
            aria-label="Widok danych"
          >
            {DATA_VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={dataView === option.value}
                onClick={() => setDataView(option.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition sm:text-sm ${
                  dataView === option.value
                    ? "bg-primary-soft text-primary"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
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

      {availableAccounts.length > 1 && dataView === "value" ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {availableAccounts.map((kind) => (
            <label
              key={kind}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted"
            >
              <input
                type="checkbox"
                checked={selectedAccounts.includes(kind)}
                onChange={() => toggleAccount(kind)}
                className="accent-primary"
              />
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: ACCOUNT_COLORS[kind] }}
              />
              {ACCOUNT_LABELS[kind]}
            </label>
          ))}
        </div>
      ) : null}

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
          <ComposedChart
            key={overlayKey || "single"}
            data={visibleData}
            margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
          >
            <defs>
              <linearGradient id="portfolioValueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={VALUE_COLOR} stopOpacity={0.45} />
                <stop offset="100%" stopColor={VALUE_COLOR} stopOpacity={0.04} />
              </linearGradient>
            </defs>
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
              domain={[axisLowerBound, "auto"]}
              tickFormatter={(value: number) =>
                new Intl.NumberFormat("pl-PL", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(value)
              }
            />
            <Tooltip content={<ChartTooltip dataView={dataView} />} />
            <Legend formatter={(value) => SERIES_LABELS[value] ?? value} />

            <ReferenceLine y={0} stroke={BASELINE_COLOR} strokeWidth={1.5} />

            {dataView === "value" ? (
              <>
                <Area
                  type={curveType}
                  dataKey="portfolioValue"
                  stroke={VALUE_COLOR}
                  fill="url(#portfolioValueFill)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type={curveType}
                  dataKey="netCapital"
                  stroke={CAPITAL_COLOR}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
                {overlayAccounts.map((kind) => (
                  <Line
                    key={kind}
                    type={curveType}
                    dataKey={`account_${kind}`}
                    name={kind}
                    stroke={ACCOUNT_COLORS[kind]}
                    strokeWidth={1.5}
                    strokeDasharray="4 3"
                    dot={false}
                    connectNulls
                  />
                ))}
                {flowMarkers.map((point) =>
                  point.depositDelta > 0 ? (
                    <ReferenceDot
                      key={`dep-${point.time}`}
                      x={point.label}
                      y={point.portfolioValue}
                      r={4}
                      fill={DEPOSIT_COLOR}
                      stroke="#fff"
                      strokeWidth={1.5}
                    />
                  ) : null,
                )}
                {flowMarkers.map((point) =>
                  point.withdrawalDelta > 0 ? (
                    <ReferenceDot
                      key={`wd-${point.time}`}
                      x={point.label}
                      y={point.portfolioValue}
                      r={4}
                      fill={WITHDRAWAL_COLOR}
                      stroke="#fff"
                      strokeWidth={1.5}
                    />
                  ) : null,
                )}
              </>
            ) : null}

            {dataView === "profit" ? (
              <Line
                type={curveType}
                dataKey="cumulativeGain"
                name="cumulativeGainLine"
                stroke={VALUE_COLOR}
                strokeWidth={2.5}
                dot={mode === "advanced" && visibleData.length <= 40 ? { r: 2.5 } : false}
              />
            ) : null}

            {dataView === "flows" ? (
              <>
                <Bar dataKey="depositDelta" name="depositDelta" fill={DEPOSIT_COLOR} radius={[3, 3, 0, 0]} />
                <Bar
                  dataKey="withdrawalDelta"
                  name="withdrawalDelta"
                  fill={WITHDRAWAL_COLOR}
                  radius={[3, 3, 0, 0]}
                />
              </>
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {dataView === "value" ? (
        <p className="mt-3 text-xs text-muted">
          Odstęp między obszarem a linią przerywaną to zysk lub strata całkowita. Kapitał netto
          poniżej linii zera oznacza, że wypłacono więcej, niż wpłacono.{" "}
          {marketMarked
            ? "Akcje GPW wyceniane kursem zamknięcia; pozycje bez notowań — po koszcie."
            : "Brak dziennych notowań — pozycje wyceniane po koszcie z historii XTB."}
        </p>
      ) : null}

      {mode === "advanced" && series.length > 1 && dataView === "value" ? (
        <div className="mt-4 h-16 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
              <XAxis dataKey="label" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Area
                type={curveType}
                dataKey="portfolioValue"
                stroke={VALUE_COLOR}
                fill={VALUE_COLOR}
                fillOpacity={0.2}
                strokeWidth={1}
              />
              <Brush
                dataKey="label"
                height={28}
                stroke={DEPOSIT_COLOR}
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
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </section>
  );
}
