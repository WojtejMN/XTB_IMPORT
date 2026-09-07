export type AuthProviderKind = "password" | "google";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  provider: AuthProviderKind;
  createdAt: string;
};

export type StoredAccount = AuthUser & {
  /** SHA-256 hasła; brak dla kont Google. */
  passwordHash?: string;
};

export type NewsletterEntry = {
  email: string;
  source: "newsletter" | "account";
  createdAt: string;
};

export type AuthStoreSnapshot = {
  accounts: StoredAccount[];
  newsletter: NewsletterEntry[];
  sessionUserId: string | null;
};

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; error: string };

export type NewsletterResult =
  | { ok: true; alreadySubscribed: boolean }
  | { ok: false; error: string };
