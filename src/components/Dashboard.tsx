"use client";

import { useEffect, useMemo, useState } from "react";
import {
  analyzeAccountBreakdown,
  analyzePerAccountCharts,
  analyzePortfolio,
} from "@/lib/analysis/portfolio";
import { stampAccountKind } from "@/lib/xtb/account";
import { emptyFileNotice, partitionImportedFiles } from "@/lib/xtb/import";
import { mergeParsedFiles } from "@/lib/xtb/merge";
import { parseXtbFile } from "@/lib/xtb/parse";
import { sampleAccounts } from "@/lib/xtb/sample";
import type { AccountKind, ParsedXtbFile } from "@/lib/xtb/types";
import { AccountBreakdownCards } from "./AccountBreakdownCards";
import { SaveAnalysisPrompt } from "./auth/SaveAnalysisPrompt";
import { AccountTabs } from "./AccountTabs";
import { ExportGuide } from "./ExportGuide";
import { FileDropzone } from "./FileDropzone";
import { ImportedFiles } from "./ImportedFiles";
import { MetricCards } from "./MetricCards";
import { OperationSummary } from "./OperationSummary";
import { PerformanceIndicators } from "./PerformanceIndicators";
import { PortfolioChart } from "./PortfolioChart";
import { PortfolioDetails } from "./PortfolioDetails";
import { PortfolioSummary } from "./PortfolioSummary";

const trustPoints = [
  "Dla inwestorów indywidualnych",
  "Konto opcjonalne",
  "Plik zostaje w przeglądarce",
];

export function Dashboard() {
  const [imports, setImports] = useState<ParsedXtbFile[]>([]);
  const [selected, setSelected] = useState<AccountKind[]>(["standard", "ike", "ikze"]);
  const [error, setError] = useState<string | null>(null);
  const [importNotices, setImportNotices] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const available = useMemo(
    () => [...new Set(imports.map((file) => file.accountKind))],
    [imports],
  );
  const activeSelection = useMemo(
    () => selected.filter((kind) => available.includes(kind)),
    [selected, available],
  );
  const selectionKey = activeSelection.slice().sort().join(",");
  const merged = useMemo(
    () => (imports.length > 0 ? mergeParsedFiles(imports, activeSelection) : null),
    [imports, selectionKey],
  );
  const report = useMemo(
    () =>
      merged
        ? analyzePortfolio(merged, {
            treatTransfersAsExternal: activeSelection.length === 1,
          })
        : null,
    [merged, selectionKey],
  );

  const accountBreakdown = useMemo(
    () => (imports.length > 0 ? analyzeAccountBreakdown(imports, activeSelection) : []),
    [imports, selectionKey],
  );

  const perAccountCharts = useMemo(
    () => (imports.length > 0 ? analyzePerAccountCharts(imports, activeSelection) : {}),
    [imports, selectionKey],
  );

  useEffect(() => {
    if (available.length === 0) {
      return;
    }
    setSelected((current) => {
      const filtered = current.filter((kind) => available.includes(kind));
      if (filtered.length > 0) {
        return filtered;
      }
      return [available[0]];
    });
  }, [available]);

  useEffect(() => {
    if (imports.length === 0) {
      return;
    }
    document.getElementById("wyniki")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [imports]);

  async function handleFiles(files: File[]) {
    setBusy(true);
    setError(null);
    setImportNotices([]);
    try {
      const parsed = await Promise.all(files.map((file) => parseXtbFile(file)));
      const { accepted, skippedEmpty, rejected } = partitionImportedFiles(parsed);

      if (accepted.length === 0) {
        if (skippedEmpty.length > 0) {
          setImportNotices(skippedEmpty.map((file) => emptyFileNotice(file)));
          return;
        }
        setError("Nie znaleziono transakcji XTB w tych plikach. Sprawdź, czy to eksport z xStation.");
        return;
      }

      setImports((current) => [...current, ...accepted]);

      const notices = skippedEmpty.map((file) => emptyFileNotice(file));
      if (notices.length > 0) {
        setImportNotices(notices);
      }
      if (rejected.length > 0) {
        setError(`Pominięto ${rejected.length} plik(i) bez rozpoznanej historii XTB.`);
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
              Wgraj eksporty z xStation — zwykły, IKE i IKZE możesz dodać razem. Policzysz wartość
              portfela, zysk oraz stopy zwrotu. Konto jest opcjonalne.
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
              setImportNotices([]);
            }}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              className="w-fit rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
              onClick={() => {
                setError(null);
                setImportNotices([]);
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

          {importNotices.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {importNotices.map((notice) => (
                <p key={notice}>{notice}</p>
              ))}
            </div>
          ) : null}

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

          {activeSelection.length > 0 && report.warnings.length > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {report.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}

          {activeSelection.length > 0 ? <PortfolioSummary report={report} /> : null}

          {activeSelection.length > 0 ? <SaveAnalysisPrompt /> : null}

          {activeSelection.length > 0 ? (
            <AccountBreakdownCards breakdown={accountBreakdown} />
          ) : null}

          {activeSelection.length > 0 ? (
            <PortfolioChart
              key={selectionKey}
              data={report.chart}
              perAccount={perAccountCharts}
              selectedAccounts={activeSelection}
              availableAccounts={available}
              onSelectedAccountsChange={(kinds) => {
                if (kinds.length === 0) {
                  return;
                }
                setSelected(kinds);
              }}
            />
          ) : null}

          {activeSelection.length > 0 ? <MetricCards report={report} /> : null}

          {activeSelection.length > 0 ? <PortfolioDetails report={report} /> : null}

          {activeSelection.length > 0 ? <PerformanceIndicators report={report} /> : null}

          <ExportGuide />
        </section>
      ) : null}
    </>
  );
}
