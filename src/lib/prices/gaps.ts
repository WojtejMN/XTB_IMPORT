export type DateRange = {
  from: string; // YYYY-MM-DD inclusive
  to: string; // YYYY-MM-DD exclusive for Yahoo period2-style end, or inclusive? We'll use inclusive end day for clarity and convert at fetch.
};

export type PriceCoverage = {
  minDate: string | null;
  maxDate: string | null;
};

function parseDay(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!);
}

function formatDay(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  return formatDay(parseDay(isoDate) + days * 24 * 60 * 60 * 1000);
}

/**
 * Oblicza brakujące zakresy dat do dociągnięcia z API.
 * `today` i daty w bazie są w formacie YYYY-MM-DD (UTC).
 */
export function computeMissingPriceRanges(
  requiredStart: string,
  today: string,
  coverage: PriceCoverage,
): DateRange[] {
  if (!requiredStart || !today || requiredStart > today) {
    return [];
  }

  if (!coverage.minDate || !coverage.maxDate) {
    return [{ from: requiredStart, to: today }];
  }

  const ranges: DateRange[] = [];

  if (requiredStart < coverage.minDate) {
    const to = addDays(coverage.minDate, -1);
    if (requiredStart <= to) {
      ranges.push({ from: requiredStart, to });
    }
  }

  if (coverage.maxDate < today) {
    const from = addDays(coverage.maxDate, 1);
    if (from <= today) {
      ranges.push({ from, to: today });
    }
  }

  return ranges;
}
