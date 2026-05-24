// Display formatters for prices, P&L, and percentages.

export function fmtPrice(value: number | undefined | null, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

export function fmtMoney(value: number, currency = "EUR"): string {
  const sign = value >= 0 ? "" : "-";
  const sym = currency === "EUR" ? "€" : currency === "USD" ? "$" : currency + " ";
  return `${sign}${sym}${Math.abs(value).toFixed(2)}`;
}

export function fmtPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function fmtPips(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}`;
}
