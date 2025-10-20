export function normalizeCurrencyToNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return NaN;
  }

  const trimmed = value.replace(/\s/g, "");

  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");
  let normalized = trimmed;

  if (hasComma && hasDot) {
    if (trimmed.lastIndexOf(",") > trimmed.lastIndexOf(".")) {
      normalized = trimmed.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = trimmed.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = trimmed.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = trimmed.replace(/,/g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}
