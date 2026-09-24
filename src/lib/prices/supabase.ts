import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type AssetPriceRow = {
  ticker: string;
  date: string;
  close_price: number;
  currency: string;
};

let cached: SupabaseClient | null = null;

/** Klient serwerowy — preferuje service role do upsertów. */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) {
    return cached;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Brak NEXT_PUBLIC_SUPABASE_URL oraz klucza Supabase (SERVICE_ROLE / ANON / PUBLISHABLE).",
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
