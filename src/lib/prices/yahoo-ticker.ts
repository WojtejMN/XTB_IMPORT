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
