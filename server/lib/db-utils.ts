/**
 * Safe DB URL parsing — no secrets in output.
 * Use for health checks and diagnostics.
 */

export interface ParsedDbUrl {
  host: string;
  port: string;
  user: string;
  database: string;
}

export function parseDbUrl(url: string): ParsedDbUrl | null {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || "5432",
      user: decodeURIComponent(u.username),
      database: u.pathname.slice(1) || "postgres",
    };
  } catch {
    return null;
  }
}
