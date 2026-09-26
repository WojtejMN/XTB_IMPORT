import { NextResponse } from "next/server";
import { fetchAssetPrices } from "@/lib/prices/query";

export const runtime = "nodejs";

function parseTickers(url: URL): string[] {
  const raw = url.searchParams.get("tickers") ?? url.searchParams.get("ticker") ?? "";
  return raw
    .split(",")
    .map((ticker) => ticker.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 40);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tickers = parseTickers(url);
  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "Podaj tickers jako listę oddzieloną przecinkami." },
      { status: 400 },
    );
  }

  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;

  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return NextResponse.json({ error: "Parametr from musi być YYYY-MM-DD." }, { status: 400 });
  }
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Parametr to musi być YYYY-MM-DD." }, { status: 400 });
  }

  try {
    const rows = await fetchAssetPrices({ tickers, from, to });
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Nie udało się pobrać cen z bazy.",
      },
      { status: 500 },
    );
  }
}
