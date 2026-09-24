import { NextResponse } from "next/server";
import { syncHistoricalPrices } from "@/lib/prices/sync";
import type { PriceSyncRequest } from "@/lib/prices/ticker-requests";

export const runtime = "nodejs";

function isValidItem(value: unknown): value is PriceSyncRequest {
  if (!value || typeof value !== "object") {
    return false;
  }
  const item = value as Partial<PriceSyncRequest>;
  return (
    typeof item.xtbTicker === "string" &&
    item.xtbTicker.trim().length > 0 &&
    typeof item.startDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.startDate)
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Niepoprawny JSON." }, { status: 400 });
  }

  const items = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { items?: unknown }).items)
      ? (body as { items: unknown[] }).items
      : null;

  if (!items || !items.every(isValidItem)) {
    return NextResponse.json(
      {
        error:
          "Oczekiwano tablicy { xtbTicker, startDate } albo obiektu { items: [...] }. Nie wysyłaj pełnej historii XTB.",
      },
      { status: 400 },
    );
  }

  // Limit chroni przed przypadkowym masowym odpytywaniem Yahoo.
  const limited = items.slice(0, 40) as PriceSyncRequest[];
  const result = await syncHistoricalPrices(limited);
  return NextResponse.json(result);
}
