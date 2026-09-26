import { describe, expect, it } from "vitest";
import {
  guessCurrencyFromXtbTicker,
  isMarketPriceTicker,
  isPlnMarketTicker,
  mapXtbTickerToYahoo,
} from "./yahoo-ticker";

describe("mapXtbTickerToYahoo", () => {
  it("mapuje GPW, USA, UK i zostawia DE", () => {
    expect(mapXtbTickerToYahoo("CDR.PL")).toBe("CDR.WA");
    expect(mapXtbTickerToYahoo("ETFBS80TR.PL")).toBe("ETFBS80TR.WA");
    expect(mapXtbTickerToYahoo("AAPL.US")).toBe("AAPL");
    expect(mapXtbTickerToYahoo("CSPX.UK")).toBe("CSPX.L");
    expect(mapXtbTickerToYahoo("SXRV.DE")).toBe("SXRV.DE");
  });
});

describe("guessCurrencyFromXtbTicker", () => {
  it("dobiera walutę po sufiksie", () => {
    expect(guessCurrencyFromXtbTicker("CDR.PL")).toBe("PLN");
    expect(guessCurrencyFromXtbTicker("AAPL.US")).toBe("USD");
    expect(guessCurrencyFromXtbTicker("SXRV.DE")).toBe("EUR");
    expect(guessCurrencyFromXtbTicker("CSPX.UK")).toBe("GBP");
  });
});

describe("isMarketPriceTicker", () => {
  it("akceptuje akcje/ETF i pomija CFD/krypto/FX", () => {
    expect(isMarketPriceTicker("CDR.PL")).toBe(true);
    expect(isMarketPriceTicker("SXRV.DE")).toBe(true);
    expect(isMarketPriceTicker("DOGECOIN")).toBe(false);
    expect(isMarketPriceTicker("GOLD")).toBe(false);
    expect(isMarketPriceTicker("GALA")).toBe(false);
    expect(isMarketPriceTicker("EUR.PL")).toBe(false);
  });

  it("MTM PLN tylko dla GPW", () => {
    expect(isPlnMarketTicker("CDR.PL")).toBe(true);
    expect(isPlnMarketTicker("SXRV.DE")).toBe(false);
    expect(isPlnMarketTicker("EUR.PL")).toBe(false);
  });
});
