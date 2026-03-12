import { normalizeCountryCode } from "@shared/lib/country-code";

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

type GoogleAutocompletePrediction = {
  placeId?: string;
  text?: { text?: string };
  structuredFormat?: {
    mainText?: { text?: string };
    secondaryText?: { text?: string };
  };
};

type GoogleAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: GoogleAutocompletePrediction;
  }>;
};

type GoogleTextSearchResponse = {
  places?: GooglePlaceDetailsResponse[];
};

export type CanonicalPlace = {
  placeId: string;
  displayName: string | null;
  formattedAddress: string | null;
  city: string | null;
  countryCode: string | null;
  countryName: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type CanonicalPlaceSuggestion = {
  locationName: string;
  displayName: string;
  city: string;
  countryCode: string;
  countryName: string;
  placeId?: string;
  formattedAddress: string;
};

function findAddressPart(
  components: Array<{ longText?: string; shortText?: string; types?: string[] }>,
  type: string,
) {
  return components.find((component) => Array.isArray(component.types) && component.types.includes(type));
}

function parseSecondaryTextParts(secondaryText: string): { city: string; countryName: string } {
  const parts = secondaryText.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return { city: "", countryName: "" };
  if (parts.length === 1) return { city: parts[0], countryName: "" };
  return {
    city: parts[0],
    countryName: parts[parts.length - 1],
  };
}

function mapPredictionToSuggestion(prediction: GoogleAutocompletePrediction): CanonicalPlaceSuggestion | null {
  const placeId = prediction.placeId?.trim() || "";
  const mainText = prediction.structuredFormat?.mainText?.text?.trim() || "";
  const secondaryText = prediction.structuredFormat?.secondaryText?.text?.trim() || "";
  const fallbackText = prediction.text?.text?.trim() || "";
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

function mapPlaceDetailsToSuggestion(place: GooglePlaceDetailsResponse): CanonicalPlaceSuggestion | null {
  const placeId = place.id?.trim() || "";
  const displayName = place.displayName?.text?.trim() || "";
  const formattedAddress = place.formattedAddress?.trim() || displayName;
  if (!displayName && !formattedAddress) return null;

  const components = Array.isArray(place.addressComponents) ? place.addressComponents : [];
  const city =
    findAddressPart(components, "locality")?.longText?.trim()
    || findAddressPart(components, "postal_town")?.longText?.trim()
    || findAddressPart(components, "administrative_area_level_3")?.longText?.trim()
    || displayName;
  const country = findAddressPart(components, "country");
  const countryCode = normalizeCountryCode(country?.shortText ?? null) ?? "";
  const countryName = country?.longText?.trim() || "";
  const locationName = formattedAddress || [displayName, countryName].filter(Boolean).join(", ");

  return {
    locationName,
    displayName: displayName || locationName,
    city,
    countryCode,
    countryName,
    placeId: placeId || undefined,
    formattedAddress: formattedAddress || locationName,
  };
}

export async function fetchPlaceSuggestions(input: {
  query: string;
  languageCode?: string | null;
  regionCode?: string | null;
}): Promise<CanonicalPlaceSuggestion[]> {
  const query = input.query.trim();
  if (query.length < 2) return [];

  const apiKey = (process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? "").trim();
  if (!apiKey) return [];

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    },
    body: JSON.stringify({
      input: query,
      languageCode: input.languageCode?.trim() || "en",
      regionCode: input.regionCode?.trim().toUpperCase() || undefined,
      includeQueryPredictions: false,
    }),
  });
  if (!res.ok) return [];

  const body = await res.json() as GoogleAutocompleteResponse;
  const predictions = Array.isArray(body.suggestions)
    ? body.suggestions
      .map((suggestion) => suggestion.placePrediction)
      .filter((item): item is GoogleAutocompletePrediction => !!item)
    : [];

  const mappedPredictions = predictions
    .map((prediction) => mapPredictionToSuggestion(prediction))
    .filter((item): item is CanonicalPlaceSuggestion => item !== null)
    .slice(0, 8);
  if (mappedPredictions.length > 0) return mappedPredictions;

  const textSearchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.addressComponents",
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: input.languageCode?.trim() || "en",
      regionCode: input.regionCode?.trim().toUpperCase() || undefined,
    }),
  });
  if (!textSearchRes.ok) return [];

  const textSearchBody = await textSearchRes.json() as GoogleTextSearchResponse;
  const places = Array.isArray(textSearchBody.places) ? textSearchBody.places : [];
  return places
    .map((place) => mapPlaceDetailsToSuggestion(place))
    .filter((item): item is CanonicalPlaceSuggestion => item !== null)
    .slice(0, 8);
}

export async function fetchCanonicalPlace(placeId: string): Promise<CanonicalPlace | null> {
  const cleanPlaceId = placeId.trim();
  if (!cleanPlaceId) return null;
  const apiKey = (process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? "").trim();
  if (!apiKey) return null;

  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(cleanPlaceId)}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,location,addressComponents",
    },
  });
  if (!res.ok) return null;

  const body = await res.json() as GooglePlaceDetailsResponse;
  const components = Array.isArray(body.addressComponents) ? body.addressComponents : [];
  const city =
    findAddressPart(components, "locality")?.longText
    || findAddressPart(components, "postal_town")?.longText
    || findAddressPart(components, "administrative_area_level_3")?.longText
    || null;
  const country = findAddressPart(components, "country");
  const countryCode = normalizeCountryCode(country?.shortText ?? null);
  const countryName = country?.longText?.trim() || null;
  const latitude = Number.isFinite(body.location?.latitude) ? Number(body.location?.latitude) : null;
  const longitude = Number.isFinite(body.location?.longitude) ? Number(body.location?.longitude) : null;

  return {
    placeId: body.id?.trim() || cleanPlaceId,
    displayName: body.displayName?.text?.trim() || null,
    formattedAddress: body.formattedAddress?.trim() || null,
    city: city?.trim() || null,
    countryCode: countryCode ?? null,
    countryName,
    latitude,
    longitude,
  };
}
