import type { AssetPriceRow } from "@/lib/prices/supabase";
import type { SyncHistoricalPricesResult } from "@/lib/prices/sync";
import type { PriceSyncRequest } from "@/lib/prices/ticker-requests";

export async function requestPriceSync(
  items: PriceSyncRequest[],
): Promise<SyncHistoricalPricesResult> {
  const response = await fetch("/api/prices/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });

  const payload = (await response.json()) as SyncHistoricalPricesResult & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Nie udało się zsynchronizować cen.");
  }
  return payload;
}

export async function requestAssetPrices(params: {
  tickers: string[];
  from?: string;
  to?: string;
}): Promise<AssetPriceRow[]> {
  const search = new URLSearchParams();
  search.set("tickers", params.tickers.join(","));
  if (params.from) {
    search.set("from", params.from);
  }
  if (params.to) {
    search.set("to", params.to);
  }

  const response = await fetch(`/api/prices?${search.toString()}`);
  const payload = (await response.json()) as { rows?: AssetPriceRow[]; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Nie udało się pobrać cen z bazy.");
  }
  return payload.rows ?? [];
}
