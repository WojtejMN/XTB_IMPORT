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
    } catch {
      setParsed(null);
      setError("Nie udało się odczytać pliku. Spróbuj XLSX albo CSV z xStation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-800">
          Panel wyników
        </p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
          Historia XTB: wpłaty, zysk i stopy zwrotu
        </h1>
        <p className="max-w-2xl text-base leading-7 text-stone-600">
          Wgraj eksport z xStation. Aplikacja policzy kumulatywną sumę wpłat, wyprodukowany zysk
          oraz łączną i roczną stopę zwrotu. Analiza odbywa się lokalnie — nic nie jest wysyłane na serwer.
        </p>
      </header>

      <FileDropzone onFile={handleFile} disabled={busy} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 transition hover:border-stone-400 hover:bg-stone-50"
          onClick={() => {
            setError(null);
            setParsed(sampleXtbHistory());
          }}
        >
          Pokaż przykładowe dane
        </button>
        {parsed ? (
          <p className="text-sm text-stone-500">
            {parsed.sourceName} · {parsed.cashOperations.length} operacji kasowych ·{" "}
            {parsed.closedPositions.length} zamkniętych pozycji
          </p>
        ) : null}
      </div>

      <ExportGuide />

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </p>
      ) : null}

      {report ? (
        <>
          <PortfolioChart data={report.chart} />

          <label className="flex max-w-md flex-col gap-2 text-sm text-stone-700">
            Aktualna wartość konta (opcjonalnie)
            <input
              type="text"
              inputMode="decimal"
              placeholder="np. 32 450,00"
              value={currentValue}
              onChange={(event) => setCurrentValue(event.target.value)}
              className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-base text-stone-900 outline-none ring-teal-700/20 focus:ring-4"
            />
            <span className="text-stone-500">
              Jeśli podasz saldo z xStation, zysk i XIRR uwzględnią otwarte pozycje.
            </span>
          </label>

          <MetricCards report={report} />

          {report.warnings.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-stone-600">
              {report.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
