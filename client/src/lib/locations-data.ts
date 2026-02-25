/**
 * Static city + country dataset for Location combobox.
 * Output: { locationName, city, countryCode, countryName }
 * Backend owns country→currency mapping; this is display only.
 */

export type LocationOption = {
  locationName: string;
  city: string;
  countryCode: string;
  countryName: string;
};

/** Minimal countryCode → currencyCode for Create Trip currency preview. Backend is source of truth. */
const COUNTRY_CURRENCY: Record<string, string> = {
  AT: "EUR", BE: "EUR", DE: "EUR", ES: "EUR", FR: "EUR", IT: "EUR", NL: "EUR",
  PT: "EUR", CH: "CHF", GB: "GBP", US: "USD", MX: "MXN", CA: "CAD", JP: "JPY",
  AU: "AUD", BR: "BRL", AR: "ARS", IN: "INR", CN: "CNY", KR: "KRW", TR: "TRY",
  PL: "PLN", SE: "SEK", NO: "NOK", DK: "DKK", CZ: "CZK", GR: "EUR", IE: "EUR",
  HU: "HUF", AE: "AED", SG: "SGD", HK: "HKD", TH: "THB", ID: "IDR",
};

export function currencyForCountry(countryCode: string): string {
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? "EUR";
}

const LOCATIONS: LocationOption[] = [
  { city: "Amsterdam", countryCode: "NL", countryName: "Netherlands", locationName: "Amsterdam, Netherlands" },
  { city: "Paris", countryCode: "FR", countryName: "France", locationName: "Paris, France" },
  { city: "Barcelona", countryCode: "ES", countryName: "Spain", locationName: "Barcelona, Spain" },
  { city: "Madrid", countryCode: "ES", countryName: "Spain", locationName: "Madrid, Spain" },
  { city: "Rome", countryCode: "IT", countryName: "Italy", locationName: "Rome, Italy" },
  { city: "Milan", countryCode: "IT", countryName: "Italy", locationName: "Milan, Italy" },
  { city: "Berlin", countryCode: "DE", countryName: "Germany", locationName: "Berlin, Germany" },
  { city: "Munich", countryCode: "DE", countryName: "Germany", locationName: "Munich, Germany" },
  { city: "London", countryCode: "GB", countryName: "United Kingdom", locationName: "London, United Kingdom" },
  { city: "Edinburgh", countryCode: "GB", countryName: "United Kingdom", locationName: "Edinburgh, United Kingdom" },
  { city: "Zurich", countryCode: "CH", countryName: "Switzerland", locationName: "Zurich, Switzerland" },
  { city: "Geneva", countryCode: "CH", countryName: "Switzerland", locationName: "Geneva, Switzerland" },
  { city: "New York", countryCode: "US", countryName: "United States", locationName: "New York, United States" },
  { city: "Los Angeles", countryCode: "US", countryName: "United States", locationName: "Los Angeles, United States" },
  { city: "Miami", countryCode: "US", countryName: "United States", locationName: "Miami, United States" },
  { city: "Mexico City", countryCode: "MX", countryName: "Mexico", locationName: "Mexico City, Mexico" },
  { city: "Cancún", countryCode: "MX", countryName: "Mexico", locationName: "Cancún, Mexico" },
  { city: "Lisbon", countryCode: "PT", countryName: "Portugal", locationName: "Lisbon, Portugal" },
  { city: "Vienna", countryCode: "AT", countryName: "Austria", locationName: "Vienna, Austria" },
  { city: "Brussels", countryCode: "BE", countryName: "Belgium", locationName: "Brussels, Belgium" },
  { city: "Dublin", countryCode: "IE", countryName: "Ireland", locationName: "Dublin, Ireland" },
  { city: "Athens", countryCode: "GR", countryName: "Greece", locationName: "Athens, Greece" },
  { city: "Prague", countryCode: "CZ", countryName: "Czech Republic", locationName: "Prague, Czech Republic" },
  { city: "Warsaw", countryCode: "PL", countryName: "Poland", locationName: "Warsaw, Poland" },
  { city: "Budapest", countryCode: "HU", countryName: "Hungary", locationName: "Budapest, Hungary" },
  { city: "Copenhagen", countryCode: "DK", countryName: "Denmark", locationName: "Copenhagen, Denmark" },
  { city: "Stockholm", countryCode: "SE", countryName: "Sweden", locationName: "Stockholm, Sweden" },
  { city: "Oslo", countryCode: "NO", countryName: "Norway", locationName: "Oslo, Norway" },
  { city: "Tokyo", countryCode: "JP", countryName: "Japan", locationName: "Tokyo, Japan" },
  { city: "Sydney", countryCode: "AU", countryName: "Australia", locationName: "Sydney, Australia" },
  { city: "Toronto", countryCode: "CA", countryName: "Canada", locationName: "Toronto, Canada" },
  { city: "São Paulo", countryCode: "BR", countryName: "Brazil", locationName: "São Paulo, Brazil" },
  { city: "Buenos Aires", countryCode: "AR", countryName: "Argentina", locationName: "Buenos Aires, Argentina" },
  { city: "Istanbul", countryCode: "TR", countryName: "Turkey", locationName: "Istanbul, Turkey" },
  { city: "Dubai", countryCode: "AE", countryName: "United Arab Emirates", locationName: "Dubai, United Arab Emirates" },
  { city: "Singapore", countryCode: "SG", countryName: "Singapore", locationName: "Singapore, Singapore" },
  { city: "Hong Kong", countryCode: "HK", countryName: "Hong Kong", locationName: "Hong Kong, Hong Kong" },
  { city: "Bangkok", countryCode: "TH", countryName: "Thailand", locationName: "Bangkok, Thailand" },
  { city: "Bali", countryCode: "ID", countryName: "Indonesia", locationName: "Bali, Indonesia" },
];

export function searchLocations(query: string): LocationOption[] {
  if (!query.trim()) return LOCATIONS.slice(0, 12);
  const q = query.toLowerCase().trim();
  return LOCATIONS.filter(
    (loc) =>
      loc.city.toLowerCase().includes(q) ||
      loc.countryName.toLowerCase().includes(q) ||
      loc.locationName.toLowerCase().includes(q)
  ).slice(0, 15);
}
