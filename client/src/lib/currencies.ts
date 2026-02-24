/**
 * Single source of truth for currencies.
 * Core list: 30–40 commonly used. All: full ISO 4217 set.
 */

import allData from "./currencies-data.json";

export type Currency = { code: string; symbol: string; name: string };

const ALL_RAW = allData as Currency[];

/** Core currencies (most used) — codes in preferred order */
export const CORE_CURRENCY_CODES = [
  "EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "CNY", "MXN", "BRL",
  "ARS", "INR", "KRW", "SGD", "HKD", "NOK", "SEK", "DKK", "PLN", "CZK",
  "HUF", "RON", "BGN", "TRY", "ZAR", "EGP", "AED", "SAR", "ILS", "THB",
  "IDR", "PHP", "NZD", "CLP", "COP", "PEN", "UAH", "RUB",
] as const;

const coreSet = new Set(CORE_CURRENCY_CODES);

/** Core list: 30–40 currencies for quick pick */
export const CoreCurrencies: Currency[] = CORE_CURRENCY_CODES
  .map((code) => ALL_RAW.find((c) => c.code === code))
  .filter((c): c is Currency => !!c);

/** All currencies (ISO 4217) */
export const AllCurrencies: Currency[] = ALL_RAW;

/** Map code → Currency for fast lookup */
const byCode = new Map<string, Currency>(ALL_RAW.map((c) => [c.code, c]));

/** Get currency by code */
export function getCurrency(code: string): Currency | undefined {
  return byCode.get(code.toUpperCase());
}

/** Symbol for display; defaults to € when missing */
export function getCurrencySymbol(code: string, fallback = "€"): string {
  return getCurrency(code || "EUR")?.symbol ?? fallback;
}

/** Display label: "€ EUR — Euro" */
export function getCurrencyLabel(currency: Currency | string): string {
  const c = typeof currency === "string" ? getCurrency(currency) : currency;
  if (!c) return currency as string;
  return `${c.symbol} ${c.code} — ${c.name}`;
}

/** Short label: "€ EUR" */
export function getCurrencyLabelShort(currency: Currency | string): string {
  const c = typeof currency === "string" ? getCurrency(currency) : currency;
  if (!c) return currency as string;
  return `${c.symbol} ${c.code}`;
}

/** Search by code, name, or symbol (case-insensitive) */
export function findCurrency(query: string): Currency[] {
  if (!query.trim()) return CoreCurrencies;
  const q = query.toLowerCase().trim();
  return ALL_RAW.filter(
    (c) =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q)
  );
}
