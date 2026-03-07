export async function resolveGoogleTimezoneId(input: {
  latitude: number;
  longitude: number;
  timestampSeconds: number;
}): Promise<string | null> {
  const apiKey = (process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY ?? "").trim();
  if (!apiKey) return null;
  const { latitude, longitude, timestampSeconds } = input;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(timestampSeconds)) return null;

  const params = new URLSearchParams({
    location: `${latitude},${longitude}`,
    timestamp: String(Math.floor(timestampSeconds)),
    key: apiKey,
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/timezone/json?${params.toString()}`, {
    method: "GET",
  });
  if (!res.ok) return null;
  const body = await res.json() as { status?: string; timeZoneId?: string };
  if (body.status !== "OK") return null;
  const tz = typeof body.timeZoneId === "string" ? body.timeZoneId.trim() : "";
  return tz || null;
}

