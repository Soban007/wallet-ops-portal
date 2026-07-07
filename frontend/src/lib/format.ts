// Display-only formatting. Money math itself always happens on the backend
// with BigInt; by the time a value reaches here it's already a decimal
// string like "12345.00" — this just adds thousands separators for readability.
export function formatAmount(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
