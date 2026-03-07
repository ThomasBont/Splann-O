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
  lat?: number;
  lng?: number;
  placeId?: string;
  displayName?: string;
  formattedAddress?: string;
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
  { city: "Bilbao", countryCode: "ES", countryName: "Spain", locationName: "Bilbao, Spain" },
  { city: "Granada", countryCode: "ES", countryName: "Spain", locationName: "Granada, Spain" },
  { city: "Madrid", countryCode: "ES", countryName: "Spain", locationName: "Madrid, Spain" },
  { city: "Málaga", countryCode: "ES", countryName: "Spain", locationName: "Málaga, Spain" },
  { city: "Sevilla", countryCode: "ES", countryName: "Spain", locationName: "Sevilla, Spain" },
  { city: "Valencia", countryCode: "ES", countryName: "Spain", locationName: "Valencia, Spain" },
  { city: "Alicante", countryCode: "ES", countryName: "Spain", locationName: "Alicante, Spain" },
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

function normalize(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function searchLocations(query: string): LocationOption[] {
  const q = normalize(query);
  if (!q) return LOCATIONS.slice(0, 12);
  if (q.length < 2) return [];

  const ranked = LOCATIONS.map((loc) => {
    const city = normalize(loc.city);
    const countryName = normalize(loc.countryName);
    const countryCode = normalize(loc.countryCode);
    const locationName = normalize(loc.locationName);

    let rank = Number.POSITIVE_INFINITY;

    if (city === q) {
      rank = 0;
    } else if (city.startsWith(q)) {
      rank = 1;
    } else if (city.includes(q)) {
      rank = 2;
    } else if (
      countryName.includes(q) ||
      countryCode.includes(q)
    ) {
      rank = 3;
    } else if (locationName.includes(q)) {
      rank = 4;
    }

    return { loc, rank };
  })
    .filter((item) => Number.isFinite(item.rank))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.loc.locationName.localeCompare(b.loc.locationName);
    });

  return ranked.slice(0, 15).map((item) => item.loc);
}
