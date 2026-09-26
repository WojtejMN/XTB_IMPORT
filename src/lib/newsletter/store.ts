import { isValidEmail, normalizeEmail } from "./email";
import type { NewsletterEntry, NewsletterResult, NewsletterStore } from "./types";

export const NEWSLETTER_STORAGE_KEY = "xtb-przeglad-newsletter-v1";

export function emptyNewsletterStore(): NewsletterStore {
  return { emails: [] };
}

export function isEmailSubscribed(store: NewsletterStore, email: string): boolean {
  const key = normalizeEmail(email);
  return store.emails.some((entry) => entry.email === key);
}

export function subscribeNewsletter(
  store: NewsletterStore,
  emailInput: string,
): { store: NewsletterStore; result: NewsletterResult } {
  const email = normalizeEmail(emailInput);
  if (!isValidEmail(email)) {
    return { store, result: { ok: false, error: "Podaj poprawny adres e-mail." } };
  }

  if (isEmailSubscribed(store, email)) {
    return { store, result: { ok: true, alreadySubscribed: true } };
  }

  const entry: NewsletterEntry = {
    email,
    createdAt: new Date().toISOString(),
  };

  return {
    store: { emails: [...store.emails, entry] },
    result: { ok: true, alreadySubscribed: false },
  };
}

export function readNewsletterStore(raw: string | null): NewsletterStore {
  if (!raw) {
    return emptyNewsletterStore();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<NewsletterStore>;
    const emails = Array.isArray(parsed.emails)
      ? parsed.emails.filter(
          (entry): entry is NewsletterEntry =>
            Boolean(entry) &&
            typeof entry === "object" &&
            typeof entry.email === "string" &&
            typeof entry.createdAt === "string",
        )
      : [];
    return { emails };
  } catch {
    return emptyNewsletterStore();
  }
}

export function serializeNewsletterStore(store: NewsletterStore): string {
  return JSON.stringify(store);
}
