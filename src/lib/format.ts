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

export function formatSignedPln(value: number): string {
  if (value < 0) {
    return `-${pln.format(Math.abs(value))}`;
  }
  return pln.format(value);
}

export function formatSignedPct(value: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  const formatted = percent.format(value);
  return value > 0 ? `+${formatted}` : formatted;
}

export function formatDatePl(date: Date): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatDays(days: number | null): string {
  if (days == null) {
    return "—";
  }
  if (days < 30) {
    return `${days} dni`;
  }
  const months = Math.round(days / 30);
  if (months < 24) {
    return `${months} mies.`;
  }
  const years = (days / 365).toFixed(1).replace(".", ",");
  return `${years} lat`;
}
