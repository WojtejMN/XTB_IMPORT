"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";

function GoogleIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.14 3.57-8.64Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3a7.2 7.2 0 0 1-10.78-3.79H1.3v3.09A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.3A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.58.38-2.3V6.61H1.3A12 12 0 0 0 0 12c0 1.94.46 3.77 1.3 5.39l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.94 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.3 6.61l3.98 3.09A7.18 7.18 0 0 1 12 4.75Z"
      />
    </svg>
  );
}

export function AuthModal() {
  const { authOpen, authMode, openAuth, closeAuth, login, register, continueWithGoogle } = useAuth();
  const titleId = useId();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [googleStep, setGoogleStep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authOpen) {
      setName("");
      setEmail("");
      setPassword("");
      setGoogleStep(false);
      setError(null);
      setBusy(false);
    }
  }, [authOpen]);

  useEffect(() => {
    if (!authOpen) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAuth();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [authOpen, closeAuth]);

  if (!authOpen) {
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (googleStep) {
        const result = await continueWithGoogle(email, name || undefined);
        if (!result.ok) {
          setError(result.error);
        }
        return;
      }
      if (authMode === "login") {
        const result = await login(email, password);
        if (!result.ok) {
          setError(result.error);
        }
        return;
      }
      const result = await register(name, email, password);
      if (!result.ok) {
        setError(result.error);
      }
    } finally {
      setBusy(false);
    }
  }

  const heading = googleStep
    ? "Kontynuuj z Google"
    : authMode === "login"
      ? "Zaloguj się"
      : "Utwórz konto";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-4 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeAuth();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-[0_24px_60px_-28px_rgba(11,42,74,0.55)] sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-xl font-semibold text-foreground">
              {heading}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {googleStep
                ? "Podaj e-mail konta Google. Historia XTB nadal zostaje tylko w przeglądarce."
                : "Konto jest opcjonalne — pozwala zapisać analizę i newsletter. Pliki XTB nie wychodzą z urządzenia."}
            </p>
          </div>
          <button
            type="button"
            onClick={closeAuth}
            className="rounded-full px-2 py-1 text-sm font-semibold text-muted hover:text-foreground"
            aria-label="Zamknij"
          >
            Esc
          </button>
        </div>

        {!googleStep ? (
          <div
            className="mt-4 inline-flex rounded-full border border-border bg-background p-1"
            role="tablist"
            aria-label="Tryb konta"
          >
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "login"}
              onClick={() => openAuth("login")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                authMode === "login" ? "bg-primary text-white" : "text-muted hover:text-foreground"
              }`}
            >
              Logowanie
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={authMode === "register"}
              onClick={() => openAuth("register")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                authMode === "register"
                  ? "bg-primary text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              Rejestracja
            </button>
          </div>
        ) : null}

        <form className="mt-5 flex flex-col gap-3" onSubmit={handleSubmit}>
          {(authMode === "register" || googleStep) && (
            <label className="flex flex-col gap-1.5 text-sm text-muted">
              Imię / nazwa
              <input
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none ring-primary/15 focus:border-primary focus:ring-4"
                placeholder={googleStep ? "opcjonalnie" : "np. Anna"}
                required={!googleStep}
              />
            </label>
          )}

          <label className="flex flex-col gap-1.5 text-sm text-muted">
            E-mail
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none ring-primary/15 focus:border-primary focus:ring-4"
              placeholder="jan@example.com"
              required
            />
          </label>

          {!googleStep ? (
            <label className="flex flex-col gap-1.5 text-sm text-muted">
              Hasło
              <input
                type="password"
                autoComplete={authMode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2.5 text-base text-foreground outline-none ring-primary/15 focus:border-primary focus:ring-4"
                placeholder={authMode === "register" ? "min. 8 znaków" : "••••••••"}
                minLength={authMode === "register" ? 8 : undefined}
                required
              />
            </label>
          ) : null}

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-negative">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="mt-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
          >
            {busy
              ? "Chwila…"
              : googleStep
                ? "Kontynuuj z Google"
                : authMode === "login"
                  ? "Zaloguj się"
                  : "Utwórz konto"}
          </button>
        </form>

        {!googleStep ? (
          <>
            <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-muted">
              <span className="h-px flex-1 bg-border" />
              albo
              <span className="h-px flex-1 bg-border" />
            </div>
            <button
              type="button"
              onClick={() => {
                setGoogleStep(true);
                setError(null);
                setPassword("");
              }}
              className="flex w-full items-center justify-center gap-3 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
            >
              <GoogleIcon />
              Kontynuuj z Google
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setGoogleStep(false);
              setError(null);
            }}
            className="mt-3 w-full text-center text-sm font-semibold text-primary hover:text-primary-hover"
          >
            Wróć do e-maila i hasła
          </button>
        )}
      </div>
    </div>
  );
}
