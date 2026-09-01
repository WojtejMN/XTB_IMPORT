"use client";

import { ACCOUNT_LABELS, ALL_ACCOUNT_KINDS } from "@/lib/xtb/account";
import type { AccountKind, ParsedXtbFile } from "@/lib/xtb/types";

type ImportedFilesProps = {
  files: ParsedXtbFile[];
  onChangeKind: (index: number, kind: AccountKind) => void;
  onRemove: (index: number) => void;
  onClear: () => void;
};

export function ImportedFiles({ files, onChangeKind, onRemove, onClear }: ImportedFilesProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">Wgrane pliki ({files.length})</p>
        <button type="button" className="text-sm font-medium text-muted hover:text-negative" onClick={onClear}>
          Wyczyść
        </button>
      </div>
      <ul className="space-y-3">
        {files.map((file, index) => (
          <li
            key={`${file.sourceName}-${index}`}
            className="flex flex-col gap-2 rounded-xl border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <p className="min-w-0 truncate text-sm text-foreground">{file.sourceName}</p>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor={`account-kind-${index}`}>
                Typ konta dla {file.sourceName}
              </label>
              <select
                id={`account-kind-${index}`}
                value={file.accountKind}
                onChange={(event) => onChangeKind(index, event.target.value as AccountKind)}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground"
              >
                {ALL_ACCOUNT_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {ACCOUNT_LABELS[kind]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="text-sm text-muted hover:text-negative"
                onClick={() => onRemove(index)}
              >
                Usuń
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
