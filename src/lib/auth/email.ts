/** Normalizuje e-mail do porównań i unikalności (trim + lowercase). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (normalized.length < 5 || normalized.length > 254) {
    return false;
  }
  // Prosta walidacja wystarczająca do UI — nie RFC pełne.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}
