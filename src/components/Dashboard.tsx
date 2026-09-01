"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzePortfolio } from "@/lib/analysis/portfolio";
import { stampAccountKind } from "@/lib/xtb/account";
import { mergeParsedFiles } from "@/lib/xtb/merge";
import { parseXtbFile } from "@/lib/xtb/parse";
import { sampleAccounts } from "@/lib/xtb/sample";
import { parseAmount } from "@/lib/xtb/values";
import type { AccountKind, ParsedXtbFile } from "@/lib/xtb/types";
import { AccountTabs } from "./AccountTabs";
import { ExportGuide } from "./ExportGuide";
import { FileDropzone } from "./FileDropzone";
import { ImportedFiles } from "./ImportedFiles";
import { MetricCards } from "./MetricCards";
import { OperationSummary } from "./OperationSummary";
import { PortfolioChart } from "./PortfolioChart";

const trustPoints = [
  "Dla inwestorów indywidualnych",
  "Bez konta i e-maila",
  "Plik zostaje w przeglądarce",
];

export function Dashboard() {
  const [imports, setImports] = useState<ParsedXtbFile[]>([]);
  const [selected, setSelected] = useState<AccountKind[]>(["standard", "ike", "ikze"]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [currentValue, setCurrentValue] = useState("");

  const available = useMemo(
    () => [...new Set(imports.map((file) => file.accountKind))],
    [imports],
  );
  const activeSelection = selected.filter((kind) => available.includes(kind));
  const merged = useMemo(
    () => (imports.length > 0 ? mergeParsedFiles(imports, activeSelection) : null),
    [imports, activeSelection],
  );
  const currentAccountValue = parseAmount(currentValue) ?? undefined;
  const report = useMemo(
    () =>
      merged && (merged.cashOperations.length > 0 || merged.closedPositions.length > 0)
        ? analyzePortfolio(merged, {
            currentAccountValue:
              currentAccountValue != null && currentAccountValue >= 0
                ? currentAccountValue
                : undefined,
            treatTransfersAsExternal: activeSelection.length === 1,
          })
        : null,
    [merged, currentAccountValue, activeSelection.length],
  );

  useEffect(() => {
    if (imports.length === 0) {
      return;
    }
    document.getElementById("wyniki")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [imports]);

  async function handleFiles(files: File[]) {
    setBusy(true);
    setError(null);
    try {
      const parsed = await Promise.all(files.map((file) => parseXtbFile(file)));
      const accepted = parsed.filter(
        (file) => file.cashOperations.length > 0 || file.closedPositions.length > 0,
      );
      const rejected = files.length - accepted.length;
      if (accepted.length === 0) {
        setError("Nie znaleziono transakcji XTB w tych plikach. Sprawdź, czy to eksport z xStation.");
        return;
      }
      setImports((current) => [...current, ...accepted]);
      if (rejected > 0) {
        setError(`Pominięto ${rejected} plik(i) bez rozpoznanej historii XTB.`);
      }
    } catch {
      setError("Nie udało się odczytać pliku. Spróbuj XLSX albo CSV z xStation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section
        id="import"
        className="scroll-mt-28 border-b border-border bg-[radial-gradient(1200px_420px_at_50%_-40px,#b7dcf3,transparent),linear-gradient(180deg,var(--hero-from),var(--hero-to))]"
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
              Wgraj eksporty z xStation — zwykły, IKE i IKZE możesz dodać razem. Policzysz sumę wpłat,
              zysk oraz stopy zwrotu, bez logowania.
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

          <FileDropzone onFiles={handleFiles} disabled={busy} />
          <ImportedFiles
            files={imports}
            onChangeKind={(index, kind) => {
              setImports((current) =>
                current.map((file, fileIndex) =>
                  fileIndex === index ? stampAccountKind(file, kind) : file,
                ),
              );
            }}
            onRemove={(index) => {
              setImports((current) => current.filter((_, fileIndex) => fileIndex !== index));
            }}
            onClear={() => {
              setImports([]);
              setError(null);
              setCurrentValue("");
            }}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              className="w-fit rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
              onClick={() => {
                setError(null);
                setCurrentValue("");
                setSelected(["standard", "ike", "ikze"]);
                setImports(sampleAccounts());
              }}
            >
              Pokaż przykładowe dane
            </button>
            {imports.length > 0 ? (
              <p className="text-sm text-muted">
                {imports.length} plik(i) · {merged?.cashOperations.length ?? 0} operacji kasowych ·{" "}
                {merged?.closedPositions.length ?? 0} zamkniętych pozycji
              </p>
            ) : (
              <p className="text-sm text-muted">Nie masz plików pod ręką? Najpierw zobacz, jak wygląda raport.</p>
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
        <section
          id="wyniki"
          className="scroll-mt-28 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8"
        >
          <AccountTabs selected={activeSelection} available={available} onChange={setSelected} />
          <OperationSummary counts={report.kindCounts} />

          {activeSelection.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Zaznacz przynajmniej jedno konto, aby zobaczyć wykres.
            </p>
          ) : null}

          {report.warnings.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {report.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          {activeSelection.length > 0 ? <PortfolioChart data={report.chart} /> : null}

          <label className="flex max-w-md flex-col gap-2 text-sm text-muted">
            Aktualna wartość zaznaczonych kont (opcjonalnie)
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

          {activeSelection.length > 0 ? <MetricCards report={report} /> : null}
          <ExportGuide />
        </section>
      ) : null}
    </>
  );
}
