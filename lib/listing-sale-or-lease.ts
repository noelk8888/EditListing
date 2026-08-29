export type SaleOrLease = "Sale" | "Lease" | "Sale/Lease";

type ListingSaleOrLeaseInput = {
  savedValue?: unknown;
  text?: unknown;
  status?: unknown;
  salePrice?: unknown;
  leasePrice?: unknown;
};

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}
export function normalizeSaleOrLease(value: unknown): SaleOrLease | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("sale") && normalized.includes("lease")) return "Sale/Lease";
  if (normalized.includes("lease") || normalized.includes("rent")) return "Lease";
  if (normalized.includes("sale")) return "Sale";
  return null;
}

/**
 * Resolves a listing's transaction type without AI. An explicitly saved value
 * wins; then explicit listing text; then an unambiguous status/price signal.
 */
export function resolveSaleOrLease(input: ListingSaleOrLeaseInput): SaleOrLease | null {
  const saved = normalizeSaleOrLease(input.savedValue);
  if (saved) return saved;

  const text = String(input.text ?? "");
  if (/\bFOR\s+(?:SALE\s*(?:AND|\/|&)\s*LEASE|SALE\/LEASE)\b/i.test(text)) return "Sale/Lease";
  if (/\bFOR\s+(?:LEASE|RENT)\b/i.test(text)) return "Lease";
  if (/\bFOR\s+SALE\b/i.test(text)) return "Sale";

  const status = String(input.status ?? "").trim().toUpperCase();
  if (/^LEASED(?:\s+OUT)?\b/.test(status) || /\bLEASED\s+OUT\b/i.test(text)) return "Lease";

  const hasSalePrice = hasValue(input.salePrice);
  const hasLeasePrice = hasValue(input.leasePrice);
  if (hasSalePrice && hasLeasePrice) return "Sale/Lease";
  if (hasLeasePrice) return "Lease";
  if (hasSalePrice) return "Sale";
  return null;
}
