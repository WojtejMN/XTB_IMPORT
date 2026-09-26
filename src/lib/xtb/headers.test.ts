import { describe, expect, it } from "vitest";
import { mapHeaderRow, isOpenPositionDetailHeader } from "./headers";

describe("mapHeaderRow", () => {
  it("preferuje kolumnę Ticker nad Instrument", () => {
    const map = mapHeaderRow([
      "Instrument",
      "Ticker",
      "Type",
      "Volume",
      "Open Time (UTC)",
      "Close Time (UTC)",
      "Profit/Loss",
    ]);
    expect(map.symbol).toBe(1);
    expect(map.volume).toBe(3);
    expect(map.openTime).toBe(4);
    expect(map.closeTime).toBe(5);
    expect(map.netProfit).toBe(6);
  });

  it("rozpoznaje nagłówek szczegółów Open Positions", () => {
    const map = mapHeaderRow([
      "Product",
      "Instrument/Position",
      "Ticker",
      "Volume",
      "Value",
      "Net Profit",
    ]);
    expect(isOpenPositionDetailHeader(map)).toBe(true);
    expect(map.symbol).toBe(2);
  });
});
