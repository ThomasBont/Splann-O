/**
 * Country → Currency mapping (ISO-3166-1 alpha-2 → ISO-4217).
 * Backend source of truth. Expand as needed.
 */

const MAP: Record<string, string> = {
  AT: "EUR", BE: "EUR", DE: "EUR", ES: "EUR", FR: "EUR", IT: "EUR", NL: "EUR",
  PT: "EUR", IE: "EUR", FI: "EUR", GR: "EUR", CY: "EUR", EE: "EUR", LV: "EUR",
  LT: "EUR", MT: "EUR", SK: "EUR", SI: "EUR", LU: "EUR",
  US: "USD", CA: "CAD", GB: "GBP", CH: "CHF", MX: "MXN", JP: "JPY", AU: "AUD",
  CN: "CNY", BR: "BRL", AR: "ARS", IN: "INR", KR: "KRW", SG: "SGD", HK: "HKD",
  NO: "NOK", SE: "SEK", DK: "DKK", PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON",
  BG: "BGN", TR: "TRY", ZA: "ZAR", EG: "EGP", AE: "AED", SA: "SAR", IL: "ILS",
  TH: "THB", ID: "IDR", PH: "PHP", NZ: "NZD", CL: "CLP", CO: "COP", PE: "PEN",
  UA: "UAH", RU: "RUB",
};

const FALLBACK = "EUR";

/** Get currency for country (ISO-3166-1 alpha-2). Uppercased. */
export function currencyForCountry(countryCode: string | null | undefined): string | undefined {
  if (!countryCode || countryCode.length !== 2) return undefined;
  return MAP[countryCode.toUpperCase()];
}

/** Resolve trip currency: country → user default → EUR */
export function resolveTripCurrency(opts: {
  countryCode?: string | null;
  userDefaultCurrency?: string | null;
}): string {
  const fromCountry = currencyForCountry(opts.countryCode);
  if (fromCountry) return fromCountry;
  const user = opts.userDefaultCurrency?.trim?.();
  if (user && user.length === 3) return user.toUpperCase();
  return FALLBACK;
}
