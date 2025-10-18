export function normalizeCurrencyToNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return NaN;
  }

  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}
