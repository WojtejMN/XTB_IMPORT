import { describe, expect, it } from "vitest";
import { isValidEmail, normalizeEmail } from "./email";
import {
  currentUser,
  hashPassword,
  isEmailOnNewsletter,
  isEmailRegistered,
  loginAccount,
  loginOrRegisterGoogle,
  registerAccount,
  subscribeNewsletter,
} from "./store";
import type { AuthStoreSnapshot } from "./types";

function empty(): AuthStoreSnapshot {
  return { accounts: [], newsletter: [], sessionUserId: null };
}

describe("normalizeEmail", () => {
  it("trimuje i zamienia na małe litery", () => {
    expect(normalizeEmail("  Jan.Kowalski@Example.COM ")).toBe("jan.kowalski@example.com");
  });
});

describe("isValidEmail", () => {
  it("akceptuje poprawne adresy", () => {
    expect(isValidEmail("a@b.pl")).toBe(true);
  });

  it("odrzuca niepoprawne adresy", () => {
    expect(isValidEmail("bez-malpy")).toBe(false);
    expect(isValidEmail("a@")).toBe(false);
  });
});

describe("auth + newsletter store", () => {
  it("rejestruje konto i nie pozwala na duplikat e-maila", async () => {
    const passwordHash = await hashPassword("haslo12345");
    const first = registerAccount(empty(), {
      email: "Ana@Example.com",
      name: "Ana",
      password: "haslo12345",
      passwordHash,
    });
    expect(first.result.ok).toBe(true);
    expect(isEmailRegistered(first.snapshot, "ana@example.com")).toBe(true);

    const duplicate = registerAccount(first.snapshot, {
      email: "ana@example.com",
      name: "Inna",
      password: "haslo12345",
      passwordHash,
    });
    expect(duplicate.result.ok).toBe(false);
    if (!duplicate.result.ok) {
      expect(duplicate.result.error).toMatch(/już konto/i);
    }
  });

  it("loguje poprawnym hasłem", async () => {
    const passwordHash = await hashPassword("haslo12345");
    const registered = registerAccount(empty(), {
      email: "user@xtb.pl",
      name: "User",
      password: "haslo12345",
      passwordHash,
    });
    const loggedOut = { ...registered.snapshot, sessionUserId: null };
    const login = loginAccount(loggedOut, { email: "user@xtb.pl", passwordHash });
    expect(login.result.ok).toBe(true);
    expect(currentUser(login.snapshot)?.email).toBe("user@xtb.pl");
  });

  it("nie duplikuje e-maili w newsletterze", () => {
    const first = subscribeNewsletter(empty(), "news@example.com");
    expect(first.result.ok).toBe(true);
    if (first.result.ok) {
      expect(first.result.alreadySubscribed).toBe(false);
    }
    expect(first.snapshot.newsletter).toHaveLength(1);

    const second = subscribeNewsletter(first.snapshot, " News@Example.com ");
    expect(second.result.ok).toBe(true);
    if (second.result.ok) {
      expect(second.result.alreadySubscribed).toBe(true);
    }
    expect(second.snapshot.newsletter).toHaveLength(1);
    expect(isEmailOnNewsletter(second.snapshot, "news@example.com")).toBe(true);
  });

  it("pozwala zapisać na newsletter e-mail konta bez drugiej pozycji", async () => {
    const passwordHash = await hashPassword("haslo12345");
    const registered = registerAccount(empty(), {
      email: "same@example.com",
      name: "Same",
      password: "haslo12345",
      passwordHash,
    });
    const first = subscribeNewsletter(registered.snapshot, "same@example.com");
    expect(first.result.ok).toBe(true);
    expect(first.snapshot.newsletter).toHaveLength(1);

    const again = subscribeNewsletter(first.snapshot, "same@example.com");
    expect(again.result.ok).toBe(true);
    if (again.result.ok) {
      expect(again.result.alreadySubscribed).toBe(true);
    }
    expect(again.snapshot.newsletter).toHaveLength(1);
  });

  it("loguje lub rejestruje przez Google bez duplikatu konta", () => {
    const first = loginOrRegisterGoogle(empty(), {
      email: "google.user@gmail.com",
      name: "Google User",
    });
    expect(first.result.ok).toBe(true);
    expect(first.snapshot.accounts).toHaveLength(1);

    const again = loginOrRegisterGoogle(first.snapshot, {
      email: "Google.User@gmail.com",
    });
    expect(again.result.ok).toBe(true);
    expect(again.snapshot.accounts).toHaveLength(1);
  });

  it("blokuje Google, gdy e-mail ma już konto z hasłem", async () => {
    const passwordHash = await hashPassword("haslo12345");
    const registered = registerAccount(empty(), {
      email: "mixed@example.com",
      name: "Mixed",
      password: "haslo12345",
      passwordHash,
    });
    const google = loginOrRegisterGoogle(registered.snapshot, { email: "mixed@example.com" });
    expect(google.result.ok).toBe(false);
  });
});
