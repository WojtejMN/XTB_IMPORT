import { describe, expect, it } from "vitest";
import { mapXtbTickerToYahoo, guessCurrencyFromXtbTicker } from "./yahoo-ticker";

describe("mapXtbTickerToYahoo", () => {
  it("mapuje GPW, USA, UK i zostawia DE", () => {
    expect(mapXtbTickerToYahoo("CDR.PL")).toBe("CDR.WA");
    expect(mapXtbTickerToYahoo("AAPL.US")).toBe("AAPL");
    expect(mapXtbTickerToYahoo("CSPX.UK")).toBe("CSPX.L");
    expect(mapXtbTickerToYahoo("SAP.DE")).toBe("SAP.DE");
  });
});

describe("guessCurrencyFromXtbTicker", () => {
  it("dobiera walutę po sufiksie", () => {
    expect(guessCurrencyFromXtbTicker("CDR.PL")).toBe("PLN");
    expect(guessCurrencyFromXtbTicker("AAPL.US")).toBe("USD");
    expect(guessCurrencyFromXtbTicker("SAP.DE")).toBe("EUR");
    expect(guessCurrencyFromXtbTicker("CSPX.UK")).toBe("GBP");
  });
});
