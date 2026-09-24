import { getSupabaseAdmin, type AssetPriceRow } from "./supabase";

export type FetchAssetPricesParams = {
  tickers: string[];
  from?: string;
  to?: string;
};

/** Czyta dzienne ceny z Supabase dla podanych tickerów XTB. */
export async function fetchAssetPrices(
  params: FetchAssetPricesParams,
): Promise<AssetPriceRow[]> {
  const tickers = [...new Set(params.tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))];
  if (tickers.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("asset_prices")
    .select("ticker, date, close_price, currency")
    .in("ticker", tickers)
    .order("date", { ascending: true });

  if (params.from) {
    query = query.gte("date", params.from);
  }
  if (params.to) {
    query = query.lte("date", params.to);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    ticker: String(row.ticker),
    date: String(row.date),
    close_price: Number(row.close_price),
    currency: String(row.currency),
  }));
}
