import { describe, expect, it } from "vitest";
import { emptyFileNotice, isEmptyParsedFile, partitionImportedFiles } from "./import";
import type { ParsedXtbFile } from "./types";

function file(overrides: Partial<ParsedXtbFile>): ParsedXtbFile {
  return {
    sourceName: "test.xlsx",
    accountKind: "ikze",
    warnings: [],
    cashOperations: [],
    closedPositions: [],
    ...overrides,
  };
}

describe("isEmptyParsedFile", () => {
  it("traktuje plik bez operacji jako pusty", () => {
    expect(
      isEmptyParsedFile(
        file({
          recognized: true,
          warnings: ["Plik IKZE.xlsx nie zawiera operacji — konto może być puste."],
        }),
      ),
    ).toBe(true);
  });

  it("nie traktuje pliku z operacjami kasowymi jako pusty", () => {
    expect(
      isEmptyParsedFile(
        file({
          cashOperations: [
            {
              id: "1",
              kind: "deposit",
              rawType: "Deposit",
              time: new Date(),
              comment: "",
              symbol: "",
              amount: 100,
              accountKind: "ikze",
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("nie traktuje pliku z otwartymi pozycjami jako pusty", () => {
    expect(isEmptyParsedFile(file({ openProfit: 120, openPositionsValue: 500 }))).toBe(false);
  });
});

describe("partitionImportedFiles", () => {
  it("oddziela puste rozpoznane pliki od zaakceptowanych", () => {
    const empty = file({
      sourceName: "IKZE_pusty.xlsx",
      recognized: true,
      warnings: ["Plik IKZE_pusty.xlsx nie zawiera operacji — konto może być puste."],
    });
    const withData = file({
      sourceName: "PLN.xlsx",
      recognized: true,
      cashOperations: [
        {
          id: "1",
          kind: "deposit",
          rawType: "Deposit",
          time: new Date(),
          comment: "",
          symbol: "",
          amount: 1000,
          accountKind: "standard",
        },
      ],
    });

    const result = partitionImportedFiles([empty, withData]);
    expect(result.accepted).toHaveLength(1);
    expect(result.skippedEmpty).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
    expect(result.accepted[0]?.sourceName).toBe("PLN.xlsx");
  });
});

describe("emptyFileNotice", () => {
  it("używa komunikatu z parsera i dopisuje informację o pominięciu", () => {
    const notice = emptyFileNotice(
      file({
        sourceName: "IKZE_pusty.xlsx",
        warnings: ["Plik IKZE_pusty.xlsx nie zawiera operacji — konto może być puste."],
      }),
    );
    expect(notice).toContain("nie zawiera operacji");
    expect(notice).toContain("pominięty");
  });
});
