export function ExportGuide() {
  return (
    <details className="rounded-2xl border border-border bg-surface p-5 text-sm leading-6 text-muted shadow-[0_10px_30px_-20px_rgba(11,42,74,0.2)]">
      <summary className="cursor-pointer text-base font-semibold text-foreground">
        Jak wyeksportować historię z xStation?
      </summary>
      <ol className="mt-4 list-decimal space-y-2 pl-5">
        <li>
          Zaloguj się do xStation i otwórz zakładkę <strong className="text-foreground">Historia konta</strong>.
        </li>
        <li>
          Ustaw zakres dat na całą historię, a następnie wybierz{" "}
          <strong className="text-foreground">Eksportuj jako XLSX</strong>.
        </li>
        <li>
          W pliku powinny być arkusze historii kasowej i pozycji. xStation nazywa je{" "}
          <code className="rounded bg-primary-soft px-1 text-foreground">Cash Operations</code> i{" "}
          <code className="rounded bg-primary-soft px-1 text-foreground">Closed Positions</code>
          {" "}albo starszymi nazwami{" "}
          <code className="rounded bg-primary-soft px-1 text-foreground">CASH OPERATION HISTORY</code> i{" "}
          <code className="rounded bg-primary-soft px-1 text-foreground">CLOSED POSITION HISTORY</code>
          . Arkusz{" "}
          <code className="rounded bg-primary-soft px-1 text-foreground">Open Positions</code> jest
          opcjonalny — z niego bierzemy wynik otwartych pozycji.
        </li>
        <li>Możesz wgrać kilka plików naraz — np. osobny eksport dla portfela zwykłego, IKE i IKZE.</li>
      </ol>
    </details>
  );
}
