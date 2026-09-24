import YahooFinance from "yahoo-finance2";
import { computeMissingPriceRanges, type DateRange } from "./gaps";
import { getSupabaseAdmin, type AssetPriceRow } from "./supabase";
import type { PriceSyncRequest } from "./ticker-requests";
import { guessCurrencyFromXtbTicker, mapXtbTickerToYahoo } from "./yahoo-ticker";

export type TickerSyncResult = {
  xtbTicker: string;
  yahooTicker: string;
  status: "skipped" | "fetched" | "error";
  ranges: DateRange[];
  inserted: number;
  message?: string;
};

export type SyncHistoricalPricesResult = {
  results: TickerSyncResult[];
  fetchedTickers: number;
  skippedTickers: number;
  errorTickers: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Yahoo `period2` jest końcem zakresu (wyłącznie) — podajemy dzień po `to`. */
function yahooPeriod2(inclusiveTo: string): string {
  const [year, month, day] = inclusiveTo.split("-").map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day! + 1));
  return next.toISOString().slice(0, 10);
}

async function readCoverage(ticker: string): Promise<{ minDate: string | null; maxDate: string | null }> {
  const supabase = getSupabaseAdmin();

  const { data: minRow, error: minError } = await supabase
    .from("asset_prices")
    .select("date")
    .eq("ticker", ticker)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (minError) {
    throw new Error(minError.message);
  }

  const { data: maxRow, error: maxError } = await supabase
    .from("asset_prices")
    .select("date")
    .eq("ticker", ticker)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxError) {
    throw new Error(maxError.message);
  }

  return {
    minDate: minRow?.date ?? null,
    maxDate: maxRow?.date ?? null,
  };
}

async function fetchYahooRange(
  yahooTicker: string,
  range: DateRange,
): Promise<Array<{ date: Date; close: number }>> {
  const yahooFinance = new YahooFinance();
  const rows = await yahooFinance.historical(yahooTicker, {
    period1: range.from,
    period2: yahooPeriod2(range.to),
    interval: "1d",
  });

  return rows
    .filter((row) => row.close != null && Number.isFinite(row.close))
    .map((row) => ({ date: row.date, close: Number(row.close) }));
}

export async function syncHistoricalPrices(
  items: PriceSyncRequest[],
): Promise<SyncHistoricalPricesResult> {
  const today = todayIso();
  const results: TickerSyncResult[] = [];
  let fetchedTickers = 0;
  let skippedTickers = 0;
  let errorTickers = 0;

  for (const item of items) {
    const xtbTicker = item.xtbTicker.trim().toUpperCase();
    if (!xtbTicker || !item.startDate) {
      continue;
    }

    const yahooTicker = mapXtbTickerToYahoo(xtbTicker);
    const currency = guessCurrencyFromXtbTicker(xtbTicker);

    try {
      const coverage = await readCoverage(xtbTicker);
      const ranges = computeMissingPriceRanges(item.startDate, today, coverage);

      if (ranges.length === 0) {
        skippedTickers += 1;
        results.push({
          xtbTicker,
          yahooTicker,
          status: "skipped",
          ranges: [],
          inserted: 0,
          message: "Baza jest aktualna dla tego tickera.",
        });
        continue;
      }

      const records: AssetPriceRow[] = [];
      for (const range of ranges) {
        const history = await fetchYahooRange(yahooTicker, range);
        for (const row of history) {
          records.push({
            ticker: xtbTicker,
            date: row.date.toISOString().slice(0, 10),
            close_price: row.close,
            currency,
          });
        }
      }

      if (records.length > 0) {
        const supabase = getSupabaseAdmin();
        const { error } = await supabase
          .from("asset_prices")
          .upsert(records, { onConflict: "ticker,date" });
        if (error) {
          throw new Error(error.message);
        }
      }

      fetchedTickers += 1;
      results.push({
        xtbTicker,
        yahooTicker,
        status: "fetched",
        ranges,
        inserted: records.length,
      });
    } catch (error) {
      errorTickers += 1;
      results.push({
        xtbTicker,
        yahooTicker,
        status: "error",
        ranges: [],
        inserted: 0,
        message: error instanceof Error ? error.message : "Nieznany błąd synchronizacji cen.",
      });
    }
  }

  return { results, fetchedTickers, skippedTickers, errorTickers };
}
