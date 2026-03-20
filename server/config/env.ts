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

function getOptionalBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
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

export function resolveSessionSecret(): string {
  const raw = process.env.SESSION_SECRET?.trim();
  if (raw) return raw;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set");
  }
  return "dev-session-secret";
}

export function resolveVapidPublicKey(): string {
  return getOptional("VAPID_PUBLIC_KEY", "");
}

export function resolveVapidPrivateKey(): string {
  return getOptional("VAPID_PRIVATE_KEY", "");
}

export function resolveVapidSubject(): string {
  const explicitSubject = getOptional("VAPID_SUBJECT", "");
  if (explicitSubject) return explicitSubject;
  return getOptional("VAPID_CONTACT", "mailto:noreply@splanno.local");
}

export function resolveDevServerHost(): string {
  return getOptional("DEV_SERVER_HOST", "");
}

export function shouldUseDevHttps(): boolean {
  return getOptionalBool("DEV_HTTPS", false);
}

export function resolveDevHttpsKeyPath(): string {
  return getOptional("DEV_HTTPS_KEY_PATH", "");
}

export function resolveDevHttpsCertPath(): string {
  return getOptional("DEV_HTTPS_CERT_PATH", "");
}

export function resolveAnthropicApiKey(): string {
  return getOptional("ANTHROPIC_API_KEY", "");
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
    sessionSecret: resolveSessionSecret(),
    betaMode: process.env.BETA_MODE === "1",
    freeMaxEvents: getOptionalInt("FREE_MAX_EVENTS", 3),
    freeMaxParticipants: getOptionalInt("FREE_MAX_PARTICIPANTS", 10),
    frontendOrigin: getOptional("FRONTEND_ORIGIN", ""),
    baseUrl: resolveBaseUrl(),
    vapidPublicKey: resolveVapidPublicKey(),
    vapidPrivateKey: resolveVapidPrivateKey(),
    vapidSubject: resolveVapidSubject(),
    devServerHost: resolveDevServerHost(),
    devHttps: shouldUseDevHttps(),
    devHttpsKeyPath: resolveDevHttpsKeyPath(),
    devHttpsCertPath: resolveDevHttpsCertPath(),
    adminUsernames: (process.env.ADMIN_USERNAMES ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    cookieSecure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "0",
    anthropicApiKey: resolveAnthropicApiKey(),
  };
}

export type Config = ReturnType<typeof loadConfig>;
