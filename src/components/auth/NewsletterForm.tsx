"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";

type NewsletterFormProps = {
  compact?: boolean;
};

export function NewsletterForm({ compact = false }: NewsletterFormProps) {
  const { user, subscribe } = useAuth();
  const [email, setEmail] = useState(user?.email ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const result = subscribe(email || user?.email || "");
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(
      result.alreadySubscribed
        ? "Ten e-mail jest już zapisany na newsletter — bez duplikatu."
        : "Dziękujemy! Zapisaliśmy Twój e-mail na newsletter.",
    );
  }

  return (
    <div className={compact ? "" : "rounded-2xl border border-border bg-surface/80 p-4"}>
      <p className="text-sm font-semibold text-foreground">Newsletter</p>
      <p className="mt-1 text-sm text-muted">
        Krótkie informacje o nowościach. Ten sam e-mail nie zapisze się drugi raz.
      </p>
      <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="newsletter-email">
          E-mail do newslettera
        </label>
        <input
          id="newsletter-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={user?.email ?? "jan@example.com"}
          className="w-full flex-1 rounded-full border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none ring-primary/15 focus:border-primary focus:ring-4"
          required={!user}
        />
        <button
          type="submit"
          className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover"
        >
          Zapisz się
        </button>
      </form>
      {message ? <p className="mt-2 text-sm text-positive">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-negative">{error}</p> : null}
    </div>
  );
}
