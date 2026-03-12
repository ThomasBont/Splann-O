import { searchLocations, type LocationOption } from "@/lib/locations-data";
import { normalizeCountryCode } from "@shared/lib/country-code";

type GoogleAutocompletePrediction = {
  place_id?: string;
  placeId?: string;
  description?: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  text?: { text?: string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
};

type GoogleAutocompleteResponse = {
  predictions?: GoogleAutocompletePrediction[];
  suggestions?: Array<{
    queryPrediction?: GoogleAutocompletePrediction;
    placePrediction?: GoogleAutocompletePrediction;
  }>;
};

type GooglePlaceDetailsResponse = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: Array<{
    longText?: string;
    shortText?: string;
    types?: string[];
  }>;
};

const CACHE = new Map<string, LocationOption[]>();
const DETAILS_CACHE = new Map<string, Partial<LocationOption>>();

function parseSecondaryTextParts(secondaryText: string): { city: string; countryName: string } {
  const parts = secondaryText.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return { city: "", countryName: "" };
  if (parts.length === 1) return { city: parts[0], countryName: "" };
  return {
    city: parts[0],
    countryName: parts[parts.length - 1],
  };
}

function mapGooglePredictionToLocation(prediction: GoogleAutocompletePrediction): LocationOption | null {
  const placeId = prediction.placeId?.trim() || prediction.place_id?.trim() || "";
  const mainText =
    prediction.structuredFormat?.mainText?.text?.trim()
    || prediction.structured_formatting?.main_text?.trim()
    || "";
  const secondaryText =
    prediction.structuredFormat?.secondaryText?.text?.trim()
    || prediction.structured_formatting?.secondary_text?.trim()
    || "";
  const fallbackText = prediction.text?.text?.trim() || prediction.description?.trim() || "";
  const locationName = [mainText, secondaryText].filter(Boolean).join(", ") || fallbackText;
  if (!locationName) return null;
  const { city, countryName } = parseSecondaryTextParts(secondaryText);

  return {
    locationName,
    displayName: mainText || locationName,
    city,
    countryCode: "",
    countryName,
    placeId: placeId || undefined,
    formattedAddress: locationName,
  };
}

export async function searchLocationsGlobal(
  query: string,
  signal?: AbortSignal,
): Promise<LocationOption[]> {
  const q = query.trim();
  if (import.meta.env.DEV) {
    console.debug("[places] searchLocationsGlobal enter", { query, trimmedQuery: q, queryLength: q.length });
  }
  if (q.length < 2) {
    if (import.meta.env.DEV) console.debug("[places] early return: query too short");
    return [];
  }

  const language =
    (typeof navigator !== "undefined" && navigator.language?.trim()) || "en";
  const cacheKey = `${language.toLowerCase()}:${q.toLowerCase()}`;
  const googleApiKey = (
    (import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined)
    ?? (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)
    ?? (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined)
    ?? ""
  ).trim();
  const regionCode = ((import.meta.env.VITE_GOOGLE_PLACES_REGION as string | undefined) || "").trim().toUpperCase() || undefined;
  const cached = CACHE.get(cacheKey);
  if (cached) {
    if (import.meta.env.DEV) {
      console.debug("[places] cache hit", { cacheKey, cachedCount: cached.length });
    }
    return cached;
  }

  try {
    const serverRes = await fetch(
      `/api/places/autocomplete?${new URLSearchParams({
        q,
        languageCode: language,
        ...(regionCode ? { regionCode } : {}),
      }).toString()}`,
      {
        method: "GET",
        credentials: "include",
        signal,
      },
    );
    if (serverRes.ok) {
      const body = await serverRes.json() as { suggestions?: LocationOption[] };
      const suggestions = Array.isArray(body.suggestions) ? body.suggestions.slice(0, 8) : [];
      if (suggestions.length > 0) {
        CACHE.set(cacheKey, suggestions);
        return suggestions;
      }
    }
  } catch (error) {
    if ((error as Error | undefined)?.name === "AbortError") throw error;
    if (import.meta.env.DEV) {
      console.debug("[places] server autocomplete failed; falling back", { query: q, error });
    }
  }

  if (import.meta.env.DEV) {
    console.debug("[places] api key presence", { hasGoogleApiKey: Boolean(googleApiKey) });
  }
  if (!googleApiKey) {
    const fallback = searchLocations(q).slice(0, 6);
    if (import.meta.env.DEV) {
      console.debug("[places] missing api key -> fallback local search", {
        query: q,
        fallbackCount: fallback.length,
      });
    }
    if (fallback.length > 0) CACHE.set(cacheKey, fallback);
    return fallback;
  }

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": googleApiKey,
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
      },
      body: JSON.stringify({
        input: q,
        languageCode: language,
        includeQueryPredictions: false,
        regionCode,
      }),
    });
    if (!res.ok) {
      if (import.meta.env.DEV) {
        console.debug("[places] google autocomplete request failed; using local fallback", {
          status: res.status,
          query: q,
        });
      }
      const fallback = searchLocations(q).slice(0, 6);
      if (fallback.length > 0) CACHE.set(cacheKey, fallback);
      else CACHE.delete(cacheKey);
      return fallback;
    }

    const json = await res.json() as GoogleAutocompleteResponse;
    if (import.meta.env.DEV) {
      console.debug("[places] raw autocomplete response", { query: q, json });
    }

    const nextApiPredictions = Array.isArray(json.suggestions)
      ? json.suggestions.flatMap((suggestion) => {
        const values: GoogleAutocompletePrediction[] = [];
        if (suggestion.placePrediction) values.push(suggestion.placePrediction);
        if (suggestion.queryPrediction) values.push(suggestion.queryPrediction);
        return values;
      })
      : [];
    const legacyPredictions = Array.isArray(json.predictions) ? json.predictions : [];
    const predictions = [...nextApiPredictions, ...legacyPredictions];

    const mapped = predictions
      .map((prediction) => mapGooglePredictionToLocation(prediction))
      .filter((item): item is LocationOption => item !== null)
      .slice(0, 6);
    if (import.meta.env.DEV) {
      console.debug("[places] mapped suggestions", { query: q, predictions, mapped });
    }

    if (mapped.length > 0) {
      CACHE.set(cacheKey, mapped);
      return mapped;
    }

    const fallback = searchLocations(q).slice(0, 6);
    if (fallback.length > 0) CACHE.set(cacheKey, fallback);
    else CACHE.delete(cacheKey);
    return fallback;
  } catch (error) {
    if ((error as Error | undefined)?.name === "AbortError") throw error;
    if (import.meta.env.DEV) {
      console.debug("[places] autocomplete threw; using local fallback", { query: q, error });
    }
    const fallback = searchLocations(q).slice(0, 6);
    if (fallback.length > 0) CACHE.set(cacheKey, fallback);
    else CACHE.delete(cacheKey);
    return fallback;
  }
}

export async function enrichLocationByPlaceId(
  placeId: string,
  signal?: AbortSignal,
): Promise<Partial<LocationOption> | null> {
  const cleanId = placeId.trim();
  if (!cleanId) return null;
  const cached = DETAILS_CACHE.get(cleanId);
  if (cached) return cached;

  const googleApiKey = (import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined)?.trim();
  if (!googleApiKey) return null;

  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(cleanId)}`, {
    method: "GET",
    signal,
    headers: {
      "X-Goog-Api-Key": googleApiKey,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location,addressComponents",
    },
  });
  if (!res.ok) throw new Error(`GOOGLE_PLACE_DETAILS_${res.status}`);
  const body = await res.json() as GooglePlaceDetailsResponse;
  const addressComponents = Array.isArray(body.addressComponents) ? body.addressComponents : [];
  const findByType = (type: string) => addressComponents.find((component) => Array.isArray(component.types) && component.types.includes(type));
  const locality = findByType("locality")?.longText
    || findByType("postal_town")?.longText
    || findByType("administrative_area_level_3")?.longText
    || "";
  const countryName = findByType("country")?.longText || "";
  const countryCode = normalizeCountryCode(findByType("country")?.shortText ?? null) ?? "";
  const enriched: Partial<LocationOption> = {
    placeId: body.id?.trim() || cleanId,
    displayName: body.displayName?.text?.trim() || undefined,
    formattedAddress: body.formattedAddress?.trim() || undefined,
    locationName:
      body.formattedAddress?.trim()
      || [body.displayName?.text?.trim(), countryName].filter(Boolean).join(", ")
      || undefined,
    city: locality || undefined,
    countryName: countryName || undefined,
    countryCode: countryCode || undefined,
    lat: Number.isFinite(body.location?.latitude) ? Number(body.location?.latitude) : undefined,
    lng: Number.isFinite(body.location?.longitude) ? Number(body.location?.longitude) : undefined,
  };
  DETAILS_CACHE.set(cleanId, enriched);
  return enriched;
}
