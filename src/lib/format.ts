const pln = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat("pl-PL", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPln(value: number): string {
  return pln.format(value);
}

export function formatPct(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return percent.format(value);
}

export function formatSignedPct(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  const formatted = percent.format(value);
  return value > 0 ? `+${formatted}` : formatted;
}
