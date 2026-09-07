export type NewsletterEntry = {
  email: string;
  createdAt: string;
};

export type NewsletterStore = {
  emails: NewsletterEntry[];
};

export type NewsletterResult =
  | { ok: true; alreadySubscribed: boolean }
  | { ok: false; error: string };
