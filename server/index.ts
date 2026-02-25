console.log("[env] NODE_ENV=", process.env.NODE_ENV);
console.log("[env] BETA_MODE=", process.env.BETA_MODE);

import dotenv from "dotenv";
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
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
