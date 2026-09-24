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
