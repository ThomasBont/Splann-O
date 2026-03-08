/**
 * Server config: validate required env and parse optional flags.
 */

function getRequired(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`${name} must be set`);
  }
  return v.trim();
}

function getOptional(name: string, fallback: string): string {
  const v = process.env[name];
  return (v && v.trim()) || fallback;
}

function getOptionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function resolveBaseUrl(fallback = ""): string {
  const candidates = [
    process.env.BASE_URL,
    process.env.PUBLIC_BASE_URL,
    process.env.APP_BASE_URL,
    process.env.APP_URL,
    process.env.FRONTEND_ORIGIN,
    fallback,
    `http://localhost:${process.env.PORT || 5001}`,
  ];

  for (const candidate of candidates) {
    const raw = typeof candidate === "string" ? candidate.trim() : "";
    if (!raw) continue;
    return normalizeBaseUrl(raw);
  }

  return `http://localhost:${process.env.PORT || 5001}`;
}

/** Validate and export config. In production, DATABASE_URL and SESSION_SECRET are required. */
export function loadConfig() {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    getRequired("DATABASE_URL");
    getRequired("SESSION_SECRET");
  }
  return {
    nodeEnv: process.env.NODE_ENV || "development",
    port: parseInt(process.env.PORT || "5000", 10),
    databaseUrl: process.env.DATABASE_URL || "",
    sessionSecret: process.env.SESSION_SECRET || "fallback-secret-change-me",
    betaMode: process.env.BETA_MODE === "1",
    freeMaxEvents: getOptionalInt("FREE_MAX_EVENTS", 3),
    freeMaxParticipants: getOptionalInt("FREE_MAX_PARTICIPANTS", 10),
    frontendOrigin: getOptional("FRONTEND_ORIGIN", ""),
    baseUrl: resolveBaseUrl(),
    adminUsernames: (process.env.ADMIN_USERNAMES ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    cookieSecure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "0",
  };
}

export type Config = ReturnType<typeof loadConfig>;
