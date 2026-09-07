"use client";

import { useAuth } from "./AuthProvider";

export function SaveAnalysisPrompt() {
  const { user, openAuth } = useAuth();

  if (user) {
    return (
      <aside className="rounded-2xl border border-positive/25 bg-[linear-gradient(135deg,#ffffff_0%,#e8f7f2_100%)] px-4 py-4 sm:px-5">
        <p className="text-sm font-semibold text-foreground">
          Zalogowano jako {user.name} ({user.email})
        </p>
        <p className="mt-1 text-sm text-muted">
          Możesz zapisać tę analizę w swoim koncie. Plik XTB nadal nie jest wysyłany na serwer —
          zapisujemy tylko metadane sesji w tej przeglądarce.
        </p>
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl border border-primary/25 bg-[linear-gradient(135deg,#ffffff_0%,#e8f4fc_100%)] px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-5">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-foreground">
          Aby zapisać analizę, stwórz konto
        </p>
        <p className="mt-1 text-sm text-muted">
          Konto jest opcjonalne. Dzięki niemu wrócisz do wyników później. Historia transakcji
          zostaje w przeglądarce.
        </p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 sm:mt-0 sm:shrink-0">
        <button
          type="button"
          onClick={() => openAuth("register")}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          Stwórz konto
        </button>
        <button
          type="button"
          onClick={() => openAuth("login")}
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
        >
          Zaloguj się
        </button>
      </div>
    </aside>
  );
}
