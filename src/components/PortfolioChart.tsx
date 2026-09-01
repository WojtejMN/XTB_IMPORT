"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPln } from "@/lib/format";
import type { ChartPoint } from "@/lib/xtb/types";

type PortfolioChartProps = {
  data: ChartPoint[];
};

export function PortfolioChart({ data }: PortfolioChartProps) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-[0_10px_30px_-18px_rgba(11,42,74,0.25)] sm:p-6">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">Kapitał netto i wartość portfela</h2>
        <p className="text-sm text-muted">
          Niebieska linia to wpłaty minus wypłaty (kapitał włożony netto). Zielona linia to kapitał netto
          plus wyprodukowany zysk.
        </p>
      </div>
      <div className="h-80 w-full sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="#d7ebf8" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: "#4d6b85", fontSize: 12 }} minTickGap={28} />
            <YAxis
              tick={{ fill: "#4d6b85", fontSize: 12 }}
              tickFormatter={(value: number) =>
                new Intl.NumberFormat("pl-PL", {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(value)
              }
            />
            <Tooltip
              formatter={(value, name) => [
                formatPln(Number(value ?? 0)),
                name === "netCapital" ? "Kapitał netto" : "Kapitał + zysk",
              ]}
              labelFormatter={(label) => `Data: ${label}`}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #c5def0",
                fontSize: 13,
              }}
            />
            <Legend
              formatter={(value) =>
                value === "netCapital" ? "Kapitał netto (wpłaty − wypłaty)" : "Kapitał netto + zysk"
              }
            />
            <Line
              type="monotone"
              dataKey="netCapital"
              name="netCapital"
              stroke="#1a6fb5"
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="equity"
              name="equity"
              stroke="#0d7a62"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
