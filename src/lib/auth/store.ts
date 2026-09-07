import { isValidEmail, normalizeEmail } from "./email";
import type {
  AuthResult,
  AuthStoreSnapshot,
  AuthUser,
  NewsletterEntry,
  NewsletterResult,
  StoredAccount,
} from "./types";

export const AUTH_STORAGE_KEY = "xtb-przeglad-auth-v1";

const emptySnapshot = (): AuthStoreSnapshot => ({
  accounts: [],
  newsletter: [],
  sessionUserId: null,
});

export function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function toPublicUser(account: StoredAccount): AuthUser {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    provider: account.provider,
    createdAt: account.createdAt,
  };
}

export function findAccountByEmail(
  snapshot: AuthStoreSnapshot,
  email: string,
): StoredAccount | undefined {
  const key = normalizeEmail(email);
  return snapshot.accounts.find((account) => account.email === key);
}

export function isEmailRegistered(snapshot: AuthStoreSnapshot, email: string): boolean {
  return Boolean(findAccountByEmail(snapshot, email));
}

export function isEmailOnNewsletter(snapshot: AuthStoreSnapshot, email: string): boolean {
  const key = normalizeEmail(email);
  return snapshot.newsletter.some((entry) => entry.email === key);
}

export function registerAccount(
  snapshot: AuthStoreSnapshot,
  input: {
    email: string;
    name: string;
    password: string;
    passwordHash: string;
  },
): { snapshot: AuthStoreSnapshot; result: AuthResult } {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return { snapshot, result: { ok: false, error: "Podaj poprawny adres e-mail." } };
  }
  if (input.name.trim().length < 2) {
    return { snapshot, result: { ok: false, error: "Podaj imię lub nazwę (min. 2 znaki)." } };
  }
  if (input.password.length < 8) {
    return { snapshot, result: { ok: false, error: "Hasło musi mieć co najmniej 8 znaków." } };
  }
  if (isEmailRegistered(snapshot, email)) {
    return { snapshot, result: { ok: false, error: "Ten e-mail ma już konto. Zaloguj się." } };
  }

  const account: StoredAccount = {
    id: createId(),
    email,
    name: input.name.trim(),
    provider: "password",
    passwordHash: input.passwordHash,
    createdAt: new Date().toISOString(),
  };

  return {
    snapshot: {
      ...snapshot,
      accounts: [...snapshot.accounts, account],
      sessionUserId: account.id,
    },
    result: { ok: true, user: toPublicUser(account) },
  };
}

export function loginAccount(
  snapshot: AuthStoreSnapshot,
  input: { email: string; passwordHash: string },
): { snapshot: AuthStoreSnapshot; result: AuthResult } {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return { snapshot, result: { ok: false, error: "Podaj poprawny adres e-mail." } };
  }

  const account = findAccountByEmail(snapshot, email);
  if (!account) {
    return { snapshot, result: { ok: false, error: "Nie znaleziono konta o tym e-mailu." } };
  }
  if (account.provider !== "password" || !account.passwordHash) {
    return {
      snapshot,
      result: { ok: false, error: "To konto korzysta z Google. Użyj logowania Google." },
    };
  }
  if (account.passwordHash !== input.passwordHash) {
    return { snapshot, result: { ok: false, error: "Nieprawidłowe hasło." } };
  }

  return {
    snapshot: { ...snapshot, sessionUserId: account.id },
    result: { ok: true, user: toPublicUser(account) },
  };
}

export function loginOrRegisterGoogle(
  snapshot: AuthStoreSnapshot,
  input: { email: string; name?: string },
): { snapshot: AuthStoreSnapshot; result: AuthResult } {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) {
    return { snapshot, result: { ok: false, error: "Podaj poprawny adres e-mail Google." } };
  }

  const existing = findAccountByEmail(snapshot, email);
  if (existing) {
    if (existing.provider === "password") {
      return {
        snapshot,
        result: {
          ok: false,
          error: "Ten e-mail ma już konto z hasłem. Zaloguj się e-mailem i hasłem.",
        },
      };
    }
    return {
      snapshot: { ...snapshot, sessionUserId: existing.id },
      result: { ok: true, user: toPublicUser(existing) },
    };
  }

  // Newsletter mógł zająć e-mail wcześniej — wtedy zakładamy konto i wiążemy ten sam e-mail.
  const account: StoredAccount = {
    id: createId(),
    email,
    name: (input.name?.trim() || email.split("@")[0] || "Użytkownik Google").slice(0, 80),
    provider: "google",
    createdAt: new Date().toISOString(),
  };

  return {
    snapshot: {
      ...snapshot,
      accounts: [...snapshot.accounts, account],
      sessionUserId: account.id,
    },
    result: { ok: true, user: toPublicUser(account) },
  };
}

export function subscribeNewsletter(
  snapshot: AuthStoreSnapshot,
  emailInput: string,
): { snapshot: AuthStoreSnapshot; result: NewsletterResult } {
  const email = normalizeEmail(emailInput);
  if (!isValidEmail(email)) {
    return { snapshot, result: { ok: false, error: "Podaj poprawny adres e-mail." } };
  }

  if (isEmailOnNewsletter(snapshot, email)) {
    return { snapshot, result: { ok: true, alreadySubscribed: true } };
  }

  const entry: NewsletterEntry = {
    email,
    source: isEmailRegistered(snapshot, email) ? "account" : "newsletter",
    createdAt: new Date().toISOString(),
  };

  return {
    snapshot: {
      ...snapshot,
      newsletter: [...snapshot.newsletter, entry],
    },
    result: { ok: true, alreadySubscribed: false },
  };
}

export function logoutSession(snapshot: AuthStoreSnapshot): AuthStoreSnapshot {
  return { ...snapshot, sessionUserId: null };
}

export function currentUser(snapshot: AuthStoreSnapshot): AuthUser | null {
  if (!snapshot.sessionUserId) {
    return null;
  }
  const account = snapshot.accounts.find((entry) => entry.id === snapshot.sessionUserId);
  return account ? toPublicUser(account) : null;
}

export function readSnapshotFromStorage(raw: string | null): AuthStoreSnapshot {
  if (!raw) {
    return emptySnapshot();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AuthStoreSnapshot>;
    return {
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      newsletter: Array.isArray(parsed.newsletter) ? parsed.newsletter : [],
      sessionUserId: typeof parsed.sessionUserId === "string" ? parsed.sessionUserId : null,
    };
  } catch {
    return emptySnapshot();
  }
}

export function serializeSnapshot(snapshot: AuthStoreSnapshot): string {
  return JSON.stringify(snapshot);
}
