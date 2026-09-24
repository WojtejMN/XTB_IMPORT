/** Mapuje ticker XTB na symbol Yahoo Finance. */
export function mapXtbTickerToYahoo(xtbTicker: string): string {
  const ticker = xtbTicker.trim().toUpperCase();
  if (!ticker) {
    return ticker;
  }
  if (ticker.endsWith(".PL")) {
    return `${ticker.slice(0, -3)}.WA`;
  }
  if (ticker.endsWith(".US")) {
    return ticker.slice(0, -3);
  }
  if (ticker.endsWith(".UK")) {
    return `${ticker.slice(0, -3)}.L`;
  }
  return ticker;
}

/** Szacuje walutę notowania po sufiksie XTB (MVP, bez osobnego zapytania). */
export function guessCurrencyFromXtbTicker(xtbTicker: string): string {
  const ticker = xtbTicker.trim().toUpperCase();
  if (ticker.endsWith(".PL") || ticker.endsWith(".WA")) {
    return "PLN";
  }
  if (ticker.endsWith(".DE") || ticker.endsWith(".PA") || ticker.endsWith(".AS")) {
    return "EUR";
  }
  if (ticker.endsWith(".UK") || ticker.endsWith(".L")) {
    return "GBP";
  }
  if (ticker.endsWith(".US") || !ticker.includes(".")) {
    return "USD";
  }
  return "USD";
}

/**
 * CFD / krypto / pary FX — nie synchronizujemy z Yahoo.
 * Uwaga: EUR.PL kończy się na .PL, ale to nie jest spółka GPW.
 */
const NON_MARKET_TICKERS = new Set([
  "DOGECOIN",
  "GOLD",
  "GALA",
  "SILVER",
  "OIL",
  "OIL.WTI",
  "BTC",
  "ETH",
  "EUR.PL",
  "USD.PL",
  "GBP.PL",
  "CHF.PL",
  "EURUSD",
  "US500",
  "DE30",
  "US100",
]);

/** Czy ticker nadaje się do pobrania dziennych notowań (akcje/ETF). */
export function isMarketPriceTicker(xtbTicker: string): boolean {
  const ticker = xtbTicker.trim().toUpperCase();
  if (!ticker || NON_MARKET_TICKERS.has(ticker)) {
    return false;
  }
  return (
    ticker.endsWith(".PL") ||
    ticker.endsWith(".US") ||
    ticker.endsWith(".UK") ||
    ticker.endsWith(".DE") ||
    ticker.endsWith(".L") ||
    ticker.endsWith(".PA") ||
    ticker.endsWith(".AS")
  );
}

/** MTM w PLN: na razie tylko instrumenty notowane w PLN (GPW). */
export function isPlnMarketTicker(xtbTicker: string): boolean {
  const ticker = xtbTicker.trim().toUpperCase();
  return isMarketPriceTicker(ticker) && guessCurrencyFromXtbTicker(ticker) === "PLN";
}
