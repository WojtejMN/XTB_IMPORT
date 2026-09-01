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
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-stone-900">Wpłaty i wyprodukowany zysk</h2>
        <p className="text-sm text-stone-600">
          Niebieska linia to kumulatywna suma wpłat. Zielona linia to zysk zrealizowany z transakcji,
          dywidend i odsetek.
        </p>
      </div>
      <div className="h-80 w-full sm:h-96">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
            <CartesianGrid stroke="#e7e5e4" strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: "#57534e", fontSize: 12 }} minTickGap={28} />
            <YAxis
              tick={{ fill: "#57534e", fontSize: 12 }}
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
                name === "deposits" ? "Suma wpłat" : "Zysk",
              ]}
              labelFormatter={(label) => `Data: ${label}`}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e7e5e4",
                fontSize: 13,
              }}
            />
            <Legend
              formatter={(value) => (value === "deposits" ? "Suma wpłat" : "Zysk")}
            />
            <Line
              type="monotone"
              dataKey="deposits"
              name="deposits"
              stroke="#1d4ed8"
              strokeWidth={2.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="profit"
              name="profit"
              stroke="#0f766e"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
