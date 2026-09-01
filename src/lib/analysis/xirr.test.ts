import { describe, expect, it } from "vitest";
import { xirr } from "./xirr";

describe("xirr", () => {
  it("zwraca ~10% dla jednej wpłaty i wypłaty po roku", () => {
    const rate = xirr([
      { date: new Date(2021, 0, 1), amount: -1000 },
      { date: new Date(2022, 0, 1), amount: 1100 },
    ]);
    expect(rate).not.toBeNull();
    expect(rate ?? 0).toBeCloseTo(0.1, 4);
  });

  it("zgadza się z przykładem XIRR z Excela", () => {
    const rate = xirr([
      { date: new Date(2008, 0, 1), amount: -10_000 },
      { date: new Date(2008, 2, 1), amount: 2_750 },
      { date: new Date(2008, 9, 30), amount: 4_250 },
      { date: new Date(2009, 1, 15), amount: 3_250 },
      { date: new Date(2009, 3, 1), amount: 2_750 },
    ]);
    expect(rate).not.toBeNull();
    expect(rate ?? 0).toBeCloseTo(0.373362535, 5);
  });

  it("zwraca null gdy brak przepływów o przeciwnych znakach", () => {
    expect(
      xirr([
        { date: new Date(2020, 0, 1), amount: -100 },
        { date: new Date(2021, 0, 1), amount: -50 },
      ]),
    ).toBeNull();
  });
});
