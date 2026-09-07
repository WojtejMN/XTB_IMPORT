import { describe, expect, it } from "vitest";
import { isValidEmail, normalizeEmail } from "./email";
import {
  emptyNewsletterStore,
  isEmailSubscribed,
  subscribeNewsletter,
} from "./store";

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

describe("subscribeNewsletter", () => {
  it("zapisuje e-mail i nie duplikuje przy ponownym zapisie", () => {
    const first = subscribeNewsletter(emptyNewsletterStore(), "news@example.com");
    expect(first.result.ok).toBe(true);
    if (first.result.ok) {
      expect(first.result.alreadySubscribed).toBe(false);
    }
    expect(first.store.emails).toHaveLength(1);
    expect(isEmailSubscribed(first.store, "news@example.com")).toBe(true);

    const second = subscribeNewsletter(first.store, " News@Example.com ");
    expect(second.result.ok).toBe(true);
    if (second.result.ok) {
      expect(second.result.alreadySubscribed).toBe(true);
    }
    expect(second.store.emails).toHaveLength(1);
  });
});
