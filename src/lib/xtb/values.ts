const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

export function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[_./]+/g, " ")
    .replace(/\s+/g, " ");
}

export function parseAmount(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }

  if (typeof raw !== "string") {
    return null;
  }

  const compact = raw.trim().replace(/[\s\u00a0]/g, "");
  if (!compact || compact === "-" || compact === "—") {
    return null;
  }

  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let normalized = compact;

  if (lastComma > lastDot) {
    normalized = compact.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = compact.replace(/,/g, "");
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export function excelSerialToDate(serial: number): Date {
  const wholeDays = Math.floor(serial);
  const adjusted = wholeDays >= 60 ? wholeDays - 1 : wholeDays;
  const fraction = serial - wholeDays;
  const millis = Math.round(fraction * 24 * 60 * 60 * 1000);
  return new Date(EXCEL_EPOCH_UTC + adjusted * 24 * 60 * 60 * 1000 + millis);
}

export function parseDate(raw: unknown): Date | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw;
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    if (raw > 20000 && raw < 80000) {
      return excelSerialToDate(raw);
    }
    if (raw > 1_000_000_000_000) {
      const fromMillis = new Date(raw);
      return Number.isNaN(fromMillis.getTime()) ? null : fromMillis;
    }
  }

  if (typeof raw !== "string") {
    return null;
  }

  const value = raw.trim();
  if (!value) {
    return null;
  }

  const european = value.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
  );
  if (european) {
    const day = Number(european[1]);
    const month = Number(european[2]);
    const year = Number(european[3]);
    const hour = Number(european[4] ?? 0);
    const minute = Number(european[5] ?? 0);
    const second = Number(european[6] ?? 0);
    const date = new Date(year, month - 1, day, hour, minute, second);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const iso = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (iso) {
    const date = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      Number(iso[4] ?? 0),
      Number(iso[5] ?? 0),
      Number(iso[6] ?? 0),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function cellText(raw: unknown): string {
  if (raw == null) {
    return "";
  }
  if (raw instanceof Date) {
    return raw.toISOString();
  }
  return String(raw).trim();
}
