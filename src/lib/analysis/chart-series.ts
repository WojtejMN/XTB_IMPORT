import type { ChartPoint } from "../xtb/types";

export type ChartGranularity = "day" | "month" | "year";

const MONTHS_PL = [
  "sty",
  "lut",
  "mar",
  "kwi",
  "maj",
  "cze",
  "lip",
  "sie",
  "wrz",
  "paź",
  "lis",
  "gru",
] as const;

function bucketKey(time: number, granularity: ChartGranularity): string {
  const date = new Date(time);
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  if (granularity === "year") {
    return `${year}`;
  }
  if (granularity === "month") {
    return `${year}-${month}`;
  }
  return `${year}-${month}-${day}`;
}

export function formatBucketLabel(time: number, granularity: ChartGranularity): string {
  const date = new Date(time);
  if (granularity === "year") {
    return String(date.getFullYear());
  }
  if (granularity === "month") {
    return `${MONTHS_PL[date.getMonth()]} ${date.getFullYear()}`;
  }
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Zostawia ostatni punkt w każdym okresie (serie kumulatywne). */
export function aggregateChartPoints(
  points: ChartPoint[],
  granularity: ChartGranularity,
): ChartPoint[] {
  if (points.length === 0) {
    return [];
  }

  const buckets = new Map<string, ChartPoint>();
  for (const point of points) {
    const key = bucketKey(point.time, granularity);
    const existing = buckets.get(key);
    if (!existing || point.time >= existing.time) {
      buckets.set(key, {
        ...point,
        label: formatBucketLabel(point.time, granularity),
      });
    }
  }

  return [...buckets.values()].sort((a, b) => a.time - b.time);
}

export function clampChartRange(
  length: number,
  startIndex: number,
  endIndex: number,
): { startIndex: number; endIndex: number } {
  if (length <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }
  const max = length - 1;
  const start = Math.max(0, Math.min(startIndex, max));
  const end = Math.max(start, Math.min(endIndex, max));
  return { startIndex: start, endIndex: end };
}
