import { describe, expect, it } from "vitest";
import { addDays, computeMissingPriceRanges } from "./gaps";

describe("computeMissingPriceRanges", () => {
  it("pobiera całość, gdy baza jest pusta", () => {
    expect(
      computeMissingPriceRanges("2024-01-10", "2024-02-01", { minDate: null, maxDate: null }),
    ).toEqual([{ from: "2024-01-10", to: "2024-02-01" }]);
  });

  it("pobiera tylko świeże dni", () => {
    expect(
      computeMissingPriceRanges("2024-01-01", "2024-02-10", {
        minDate: "2024-01-01",
        maxDate: "2024-02-01",
      }),
    ).toEqual([{ from: "2024-02-02", to: "2024-02-10" }]);
  });

  it("pobiera starszy brakujący zakres", () => {
    expect(
      computeMissingPriceRanges("2023-05-18", "2024-02-01", {
        minDate: "2024-01-01",
        maxDate: "2024-02-01",
      }),
    ).toEqual([{ from: "2023-05-18", to: "2023-12-31" }]);
  });

  it("pobiera obie luki naraz", () => {
    expect(
      computeMissingPriceRanges("2023-05-18", "2024-02-10", {
        minDate: "2024-01-01",
        maxDate: "2024-02-01",
      }),
    ).toEqual([
      { from: "2023-05-18", to: "2023-12-31" },
      { from: "2024-02-02", to: "2024-02-10" },
    ]);
  });

  it("pomija zapytanie, gdy baza jest aktualna", () => {
    expect(
      computeMissingPriceRanges("2024-01-01", "2024-02-01", {
        minDate: "2024-01-01",
        maxDate: "2024-02-01",
      }),
    ).toEqual([]);
  });
});

describe("addDays", () => {
  it("przesuwa datę o dni", () => {
    expect(addDays("2024-01-31", 1)).toBe("2024-02-01");
    expect(addDays("2024-01-01", -1)).toBe("2023-12-31");
  });
});
