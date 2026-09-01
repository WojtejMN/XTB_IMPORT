export function ExportGuide() {
  return (
    <details className="rounded-2xl border border-stone-200 bg-white p-5 text-sm leading-6 text-stone-700 shadow-sm">
      <summary className="cursor-pointer text-base font-semibold text-stone-900">
        Jak wyeksportować historię z xStation?
      </summary>
      <ol className="mt-4 list-decimal space-y-2 pl-5">
        <li>Zaloguj się do xStation i otwórz zakładkę <strong>Historia konta</strong>.</li>
        <li>
          Ustaw zakres dat na całą historię, a następnie wybierz <strong>Eksportuj jako XLSX</strong>.
        </li>
        <li>
          W pliku powinny być arkusze <code className="rounded bg-stone-100 px-1">CASH OPERATION HISTORY</code> oraz{" "}
          <code className="rounded bg-stone-100 px-1">CLOSED POSITION HISTORY</code>.
        </li>
        <li>Możesz też wgrać samo CSV operacji kasowych albo zamkniętych pozycji (separator <code>;</code> lub <code>,</code>).</li>
      </ol>
    </details>
  );
}
