export type MapsPlatform = "ios" | "android" | "desktop";

export type MapsLocationInput = {
  query?: string | null;
  lat?: number | null;
  lng?: number | null;
  label?: string | null;
};

function hasCoords(lat?: number | null, lng?: number | null): lat is number {
  return Number.isFinite(lat) && Number.isFinite(lng);
}

export function detectPlatform(userAgent?: string): MapsPlatform {
  const ua = (userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "")).toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

export function buildMapsUrl(
  input: MapsLocationInput,
  platform: MapsPlatform = detectPlatform(),
): string {
  const query = (input.query ?? "").trim();
  const label = (input.label ?? query).trim();
  const queryEncoded = encodeURIComponent(query || label);
  const labelEncoded = encodeURIComponent(label || query);

  if (hasCoords(input.lat, input.lng)) {
    const coord = `${input.lat},${input.lng}`;
    if (platform === "ios") {
      return `https://maps.apple.com/?ll=${coord}&q=${labelEncoded}`;
    }
    if (platform === "android") {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coord)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coord)}`;
  }

  if (platform === "ios") {
    return `https://maps.apple.com/?q=${queryEncoded}`;
  }
  if (platform === "android") {
    return `https://www.google.com/maps/search/?api=1&query=${queryEncoded}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${queryEncoded}`;
}

export function openMaps(url: string, platform: MapsPlatform = detectPlatform()) {
  if (typeof window === "undefined" || !url) return;
  if (platform === "desktop") {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  window.location.assign(url);
}

