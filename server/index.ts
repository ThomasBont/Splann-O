console.log("=== ENV DEBUG START ===");
console.log("[env] NODE_ENV:", process.env.NODE_ENV);
console.log("[env] RESEND_API_KEY present:", Boolean(process.env.RESEND_API_KEY));
console.log("[env] EMAIL_FROM present:", Boolean(process.env.EMAIL_FROM));
console.log("[env] APP_BASE_URL:", process.env.APP_BASE_URL || process.env.APP_URL);
if (!process.env.RESEND_API_KEY) {
  console.warn("[env-warning] RESEND_API_KEY missing at runtime");
}
console.log("=== ENV DEBUG END ===");

import dotenv from "dotenv";
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ debug: true });
}

console.log("[env] RESEND_API_KEY present (post-dotenv):", Boolean(process.env.RESEND_API_KEY));
console.log("[env] EMAIL_FROM present (post-dotenv):", Boolean(process.env.EMAIL_FROM));
if (!process.env.RESEND_API_KEY) {
  console.warn("[env-warning] RESEND_API_KEY still missing after dotenv");
}

import { loadConfig } from "./config/env";
try {
  loadConfig();
} catch (e) {
  if (process.env.NODE_ENV === "production") {
    console.error("Config validation failed:", e);
    process.exit(1);
  }
}

import { createServer } from "http";
import { createApp } from "./app";
import { serveStatic } from "./static";
import { log } from "./lib/logger";
import { pool } from "./db";

const app = createApp();
const httpServer = createServer(app);

function gracefulShutdown(signal: string) {
  log("info", `${signal} received, closing server and pool`);
  httpServer.close(() => {
    pool.end().then(
      () => process.exit(0),
      (err) => {
        console.error("Pool close error:", err);
        process.exit(1);
      }
    );
  });
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

(async () => {
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    { port, host: "0.0.0.0", reusePort: true },
    () => {
      log("info", `serving on port ${port}`);
      if (process.env.RESEND_API_KEY) {
        log("info", "Email: Resend configured", { source: "email" });
      } else {
        log("info", "Email: RESEND_API_KEY not set; welcome and password-reset emails disabled", { source: "email" });
      }
    }
  );
})();
