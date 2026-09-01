"use client";

import { useMemo, useState } from "react";
import { analyzePortfolio } from "@/lib/analysis/portfolio";
import { parseAmount } from "@/lib/xtb/values";
import { parseXtbFile } from "@/lib/xtb/parse";
import { sampleXtbHistory } from "@/lib/xtb/sample";
import type { ParsedXtbFile } from "@/lib/xtb/types";
import { ExportGuide } from "./ExportGuide";
import { FileDropzone } from "./FileDropzone";
import { MetricCards } from "./MetricCards";
import { PortfolioChart } from "./PortfolioChart";

const trustPoints = [
  "Dla inwestorów indywidualnych",
  "Bez konta i e-maila",
  "Plik zostaje w przeglądarce",
];

export function Dashboard() {
  const [parsed, setParsed] = useState<ParsedXtbFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [currentValue, setCurrentValue] = useState("");

  const currentAccountValue = parseAmount(currentValue) ?? undefined;
  const report = useMemo(
    () =>
      parsed
        ? analyzePortfolio(parsed, {
            currentAccountValue:
              currentAccountValue != null && currentAccountValue >= 0
                ? currentAccountValue
                : undefined,
          })
        : null,
    [parsed, currentAccountValue],
  );

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const next = await parseXtbFile(file);
      if (next.cashOperations.length === 0 && next.closedPositions.length === 0) {
        setParsed(null);
        setError("Nie znaleziono transakcji XTB w tym pliku. Sprawdź, czy to eksport z xStation.");
        return;
      }
      setParsed(next);
      setCurrentValue("");
    } catch {
      setParsed(null);
      setError("Nie udało się odczytać pliku. Spróbuj XLSX albo CSV z xStation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section
        id="import"
        className="scroll-mt-28 border-b border-border bg-[linear-gradient(180deg,var(--hero-from),var(--hero-to))]"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              Analiza historii XTB
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-5xl sm:leading-[1.15]">
              Sprawdź swoje wyniki. Spokojnie i przejrzyście.
            </h1>
            <p className="mt-4 text-base leading-7 text-muted sm:text-lg">
              Wgraj eksport z xStation. Policzysz sumę wpłat, wyprodukowany zysk oraz łączną i
              roczną stopę zwrotu — bez logowania, w kilka chwil.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {trustPoints.map((point) => (
                <li
                  key={point}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted sm:text-sm"
                >
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <FileDropzone onFile={handleFile} disabled={busy} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              className="w-fit rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
              onClick={() => {
                setError(null);
                setCurrentValue("");
                setParsed(sampleXtbHistory());
              }}
            >
              Pokaż przykładowe dane
            </button>
            {parsed ? (
              <p className="text-sm text-muted">
                {parsed.sourceName} · {parsed.cashOperations.length} operacji kasowych ·{" "}
                {parsed.closedPositions.length} zamkniętych pozycji
              </p>
            ) : (
              <p className="text-sm text-muted">Nie masz pliku pod ręką? Najpierw zobacz, jak wygląda raport.</p>
            )}
          </div>

          {report ? null : <ExportGuide />}

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-negative">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      {report ? (
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
          {report.warnings.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {report.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          <PortfolioChart data={report.chart} />

          <label className="flex max-w-md flex-col gap-2 text-sm text-muted">
            Aktualna wartość konta (opcjonalnie)
            <input
              type="text"
              inputMode="decimal"
              placeholder="np. 32 450,00"
              value={currentValue}
              onChange={(event) => setCurrentValue(event.target.value)}
              className="rounded-xl border border-border bg-surface px-3 py-2.5 text-base text-foreground outline-none ring-primary/15 focus:border-primary focus:ring-4"
            />
            <span>Jeśli podasz saldo z xStation, zysk i XIRR uwzględnią otwarte pozycje.</span>
          </label>

          <MetricCards report={report} />
          <ExportGuide />
        </section>
      ) : null}
    </>
  );
}
