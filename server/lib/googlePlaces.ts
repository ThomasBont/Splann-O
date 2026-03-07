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

function findAddressPart(
  components: Array<{ longText?: string; shortText?: string; types?: string[] }>,
  type: string,
) {
  return components.find((component) => Array.isArray(component.types) && component.types.includes(type));
}

export async function fetchCanonicalPlace(placeId: string): Promise<CanonicalPlace | null> {
  const cleanPlaceId = placeId.trim();
  if (!cleanPlaceId) return null;
  const apiKey = (process.env.GOOGLE_PLACES_API_KEY ?? "").trim();
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

