import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: string | number): string {
  if (!price) return "";
  const num = typeof price === "string" ? parseFloat(price.replace(/[^0-9.-]/g, "")) : price;
  if (isNaN(num)) return "";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function parseArea(areaString: string): number | null {
  if (!areaString) return null;
  const match = areaString.match(/[\d,]+\.?\d*/);
  if (!match) return null;
  return parseFloat(match[0].replace(/,/g, ""));
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Returns the current date in Philippine Standard Time (UTC+8) in YYYY-MM-DD format.
 */
export function getPHLDate(): string {
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' };
  // Using sv-SE as it natively formats to YYYY-MM-DD
  return new Intl.DateTimeFormat('sv-SE', options).format(date);
}

/**
 * Returns a complete ISO string artificially adjusted to match physical PHL time.
 * Note: The string ends in Z but represents UTC+8 physical time. Useful for Supabase timestamp storage.
 */
export function getPHLTimestamp(): string {
  const d = new Date();
  const phDate = new Date(d.getTime() + (8 * 60 * 60 * 1000));
  return phDate.toISOString();
}
