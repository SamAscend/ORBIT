export function hasRecoveryAuthentication(amr: unknown): boolean {
  if (!Array.isArray(amr)) return false;

  return amr.some((entry: unknown) => entry === "recovery"
    || (typeof entry === "object"
      && entry !== null
      && "method" in entry
      && entry.method === "recovery"));
}
