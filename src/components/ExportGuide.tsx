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
          W pliku powinny być arkusze{" "}
          <code className="rounded bg-primary-soft px-1 text-foreground">CASH OPERATION HISTORY</code> oraz{" "}
          <code className="rounded bg-primary-soft px-1 text-foreground">CLOSED POSITION HISTORY</code>.
        </li>
        <li>
          Możesz też wgrać samo CSV operacji kasowych albo zamkniętych pozycji (separator{" "}
          <code className="rounded bg-primary-soft px-1">;</code> lub{" "}
          <code className="rounded bg-primary-soft px-1">,</code>).
        </li>
      </ol>
    </details>
  );
}
