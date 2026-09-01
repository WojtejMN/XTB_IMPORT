"use client";

import { ACCOUNT_LABELS, ALL_ACCOUNT_KINDS } from "@/lib/xtb/account";
import type { AccountKind } from "@/lib/xtb/types";

type AccountTabsProps = {
  selected: AccountKind[];
  available: AccountKind[];
  onChange: (next: AccountKind[]) => void;
};

export function AccountTabs({ selected, available, onChange }: AccountTabsProps) {
  function toggle(kind: AccountKind) {
    if (selected.includes(kind)) {
      onChange(selected.filter((entry) => entry !== kind));
      return;
    }
    onChange([...selected, kind]);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Które konta pokazać?</h2>
          <p className="text-sm text-muted">Możesz zaznaczyć kilka naraz — wykres i stopy liczą się razem.</p>
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-primary hover:text-primary-hover"
          onClick={() => onChange([...available])}
        >
          Zaznacz wszystkie
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Wybór kont">
        {ALL_ACCOUNT_KINDS.map((kind) => {
          const isOn = selected.includes(kind);
          const isAvailable = available.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              disabled={!isAvailable}
              aria-pressed={isOn}
              onClick={() => toggle(kind)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                isOn
                  ? "bg-primary text-white shadow-sm"
                  : "border border-border bg-surface text-foreground hover:border-primary"
              } ${isAvailable ? "" : "cursor-not-allowed opacity-40"}`}
            >
              {ACCOUNT_LABELS[kind]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
