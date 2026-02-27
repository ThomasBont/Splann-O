import { searchLocations, type LocationOption } from "@/lib/locations-data";

type MapboxFeature = {
  place_name?: string;
  text?: string;
  center?: [number, number];
  context?: Array<{
    id?: string;
    text?: string;
    short_code?: string;
  }>;
};

const CACHE = new Map<string, LocationOption[]>();

function normalizeCountryCode(code?: string | null): string {
  if (!code) return "";
  return code.replace(/^country\./i, "").toUpperCase();
}

function mapFeatureToLocation(feature: MapboxFeature): LocationOption | null {
  const context = Array.isArray(feature.context) ? feature.context : [];
  const countryCtx = context.find((c) => c.id?.startsWith("country"));
  const placeCtx = context.find((c) => c.id?.startsWith("place"));
  const localityCtx = context.find((c) => c.id?.startsWith("locality"));
  const regionCtx = context.find((c) => c.id?.startsWith("region"));
  const center = Array.isArray(feature.center) ? feature.center : undefined;

  const locationName = feature.place_name?.trim() || feature.text?.trim();
  if (!locationName) return null;

  const countryCode = normalizeCountryCode(countryCtx?.short_code ?? null);
  const countryName = (countryCtx?.text ?? "").trim();
  const city = (placeCtx?.text ?? localityCtx?.text ?? feature.text ?? regionCtx?.text ?? "").trim();

  const lat = center && Number.isFinite(center[1]) ? Number(center[1]) : undefined;
  const lng = center && Number.isFinite(center[0]) ? Number(center[0]) : undefined;

  return {
    locationName,
    city,
    countryCode,
    countryName,
    lat,
    lng,
  };
}

export async function searchLocationsGlobal(
  query: string,
  signal?: AbortSignal,
): Promise<LocationOption[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const language =
    (typeof navigator !== "undefined" && navigator.language?.trim()) || "en";
  const cacheKey = `${language.toLowerCase()}:${q.toLowerCase()}`;
  const cached = CACHE.get(cacheKey);
  if (cached) return cached;

  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  if (!token) {
    const fallback = searchLocations(q).slice(0, 6);
    CACHE.set(cacheKey, fallback);
    return fallback;
  }

  const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`;
  const params = new URLSearchParams({
    access_token: token,
    autocomplete: "true",
    types: "place,locality,region,postcode",
    limit: "6",
    language,
  });

  const res = await fetch(`${endpoint}?${params.toString()}`, { signal });
  if (!res.ok) {
    throw new Error(`MAPBOX_${res.status}`);
  }

  const json = await res.json() as { features?: MapboxFeature[] };
  const features = Array.isArray(json.features) ? json.features : [];
  const mapped = features
    .map(mapFeatureToLocation)
    .filter((item): item is LocationOption => item !== null)
    .slice(0, 6);

  CACHE.set(cacheKey, mapped);
  return mapped;
}

