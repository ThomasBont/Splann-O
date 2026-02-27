import type { LocationOption } from "@/lib/locations-data";

export type LocationSuggestionSection = {
  id: "recent" | "suggested" | "popular";
  label: string;
  items: LocationOption[];
};

export type LocationUiText = {
  recent: string;
  suggested: string;
  popular: string;
  clear: string;
  noResults: string;
  useTyped: string;
  placeholder: string;
};

const POPULAR_LOCATIONS: LocationOption[] = [
  { locationName: "Amsterdam, Netherlands", city: "Amsterdam", countryCode: "NL", countryName: "Netherlands" },
  { locationName: "London, United Kingdom", city: "London", countryCode: "GB", countryName: "United Kingdom" },
  { locationName: "Paris, France", city: "Paris", countryCode: "FR", countryName: "France" },
  { locationName: "Berlin, Germany", city: "Berlin", countryCode: "DE", countryName: "Germany" },
  { locationName: "New York, United States", city: "New York", countryCode: "US", countryName: "United States" },
  { locationName: "Los Angeles, United States", city: "Los Angeles", countryCode: "US", countryName: "United States" },
  { locationName: "Mexico City, Mexico", city: "Mexico City", countryCode: "MX", countryName: "Mexico" },
  { locationName: "São Paulo, Brazil", city: "São Paulo", countryCode: "BR", countryName: "Brazil" },
  { locationName: "Tokyo, Japan", city: "Tokyo", countryCode: "JP", countryName: "Japan" },
  { locationName: "Singapore, Singapore", city: "Singapore", countryCode: "SG", countryName: "Singapore" },
  { locationName: "Sydney, Australia", city: "Sydney", countryCode: "AU", countryName: "Australia" },
  { locationName: "Cape Town, South Africa", city: "Cape Town", countryCode: "ZA", countryName: "South Africa" },
  { locationName: "Remote / Online", city: "Remote", countryCode: "", countryName: "" },
];

export function getPopularLocationSuggestions(query: string): LocationOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return POPULAR_LOCATIONS.slice(0, 8);
  return POPULAR_LOCATIONS
    .filter((loc) => loc.locationName.toLowerCase().includes(q) || loc.city.toLowerCase().includes(q))
    .slice(0, 8);
}

function dedupeByName(items: LocationOption[]): LocationOption[] {
  const seen = new Set<string>();
  const result: LocationOption[] = [];
  for (const item of items) {
    const key = item.locationName.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function rankLocations(items: LocationOption[], query: string): LocationOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return dedupeByName(items);
  return dedupeByName(items)
    .map((item) => {
      const value = item.locationName.toLowerCase();
      let score = 3;
      if (value.startsWith(q)) score = 0;
      else if (item.city.toLowerCase().startsWith(q)) score = 1;
      else if (value.includes(q)) score = 2;
      return { item, score };
    })
    .sort((a, b) => (a.score - b.score) || a.item.locationName.localeCompare(b.item.locationName))
    .map((entry) => entry.item);
}

export function buildLocationSuggestionSections(params: {
  query: string;
  recent: LocationOption[];
  suggested: LocationOption[];
  uiText: LocationUiText;
}): LocationSuggestionSection[] {
  const { query, recent, suggested, uiText } = params;
  const q = query.trim();
  const recentItems = rankLocations(recent, q).slice(0, 6);
  const suggestedItems = rankLocations(suggested, q).slice(0, 6);
  const popularItems = getPopularLocationSuggestions(q);
  const sections: LocationSuggestionSection[] = [
    { id: "recent", label: uiText.recent, items: recentItems },
    { id: "suggested", label: uiText.suggested, items: suggestedItems },
    { id: "popular", label: uiText.popular, items: popularItems },
  ];
  return sections.filter((section) => section.items.length > 0);
}
