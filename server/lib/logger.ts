/**
 * Simple structured console logger. Supports reqId for request tracing.
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

export function log(
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown> & { reqId?: string }
): void {
  const timestamp = new Date().toISOString();
  const payload = { level, message, ...meta };
  const line = JSON.stringify({ timestamp, ...payload });
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}
