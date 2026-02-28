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
import { db, pool } from "./db";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { eq } from "drizzle-orm";
import { session as sessionTable } from "@shared/schema";
import { createHmac, timingSafeEqual } from "crypto";
import * as bbqService from "./services/bbqService";
import { appendEventChatMessage } from "./lib/eventChatStore";
import { broadcastEventRealtime, registerEventSocket, unregisterEventSocket } from "./lib/eventRealtime";

const app = createApp();
const httpServer = createServer(app);
const chatWss = new WebSocketServer({ noServer: true });

type WsClientMeta = {
  eventId: number;
  userId: number;
  username: string;
};

function parseCookieHeader(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    result[k] = decodeURIComponent(rest.join("=") ?? "");
  }
  return result;
}

function unsignSessionIdCookie(value: string, secret: string): string | null {
  if (!value || !value.startsWith("s:")) return null;
  const signed = value.slice(2);
  const lastDot = signed.lastIndexOf(".");
  if (lastDot <= 0) return null;
  const sid = signed.slice(0, lastDot);
  const signature = signed.slice(lastDot + 1);
  const expected = createHmac("sha256", secret).update(sid).digest("base64").replace(/=+$/g, "");
  const expectedBuf = Buffer.from(expected);
  const gotBuf = Buffer.from(signature);
  if (expectedBuf.length !== gotBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, gotBuf)) return null;
  return sid;
}

async function resolveUserFromRequest(req: import("http").IncomingMessage): Promise<{ id: number; username: string } | null> {
  const sessionSecret = process.env.SESSION_SECRET || "fallback-secret-change-me";
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const rawCookie = cookies["splanno.sid"];
  if (!rawCookie) return null;
  const sid = unsignSessionIdCookie(rawCookie, sessionSecret);
  if (!sid) return null;
  const row = await db
    .select({ sess: sessionTable.sess })
    .from(sessionTable)
    .where(eq(sessionTable.sid, sid))
    .limit(1);
  const payload = row[0]?.sess as { userId?: unknown; username?: unknown } | undefined;
  const userId = typeof payload?.userId === "number" ? payload.userId : null;
  const username = typeof payload?.username === "string" ? payload.username : null;
  if (!userId || !username) return null;
  return { id: userId, username };
}

chatWss.on("connection", (ws, req) => {
  const meta = (req as import("http").IncomingMessage & { chatMeta?: WsClientMeta }).chatMeta;
  if (!meta) {
    ws.close(1008, "unauthorized");
    return;
  }
  registerEventSocket(meta.eventId, ws);
  ws.send(JSON.stringify({ type: "hello" }));

  ws.on("message", (raw: RawData) => {
    let parsed: { type?: string; text?: string } | null = null;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      ws.send(JSON.stringify({ type: "error", code: "VALIDATION_ERROR", message: "Invalid payload" }));
      return;
    }

    if (parsed?.type === "event:subscribe") {
      return;
    }
    if (parsed?.type !== "send") return;
    const text = typeof parsed.text === "string" ? parsed.text.trim() : "";
    if (!text) return;
    if (text.length > 4000) {
      ws.send(JSON.stringify({ type: "error", code: "VALIDATION_ERROR", message: "Message too long" }));
      return;
    }

    const message = appendEventChatMessage(meta.eventId, {
      type: "user",
      text,
      user: { id: String(meta.userId), name: meta.username },
    });
    broadcastEventRealtime(meta.eventId, { type: "message", message });
  });

  ws.on("close", () => {
    unregisterEventSocket(meta.eventId, ws);
  });
});

httpServer.on("upgrade", async (req, socket, head) => {
  try {
    const url = new URL(req.url ?? "", "http://localhost");
    const match = /^\/ws\/events\/(\d+)\/chat$/.exec(url.pathname);
    if (!match) {
      socket.destroy();
      return;
    }
    const eventId = Number(match[1]);
    if (!Number.isInteger(eventId) || eventId <= 0) {
      socket.destroy();
      return;
    }
    const user = await resolveUserFromRequest(req);
    if (!user) {
      socket.destroy();
      return;
    }
    const access = await bbqService.getBarbecueIfAccessible(eventId, user.id, user.username);
    if (!access) {
      socket.destroy();
      return;
    }
    (req as import("http").IncomingMessage & { chatMeta?: WsClientMeta }).chatMeta = {
      eventId,
      userId: user.id,
      username: user.username,
    };
    chatWss.handleUpgrade(req, socket, head, (ws) => {
      chatWss.emit("connection", ws, req);
    });
  } catch {
    socket.destroy();
  }
});

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
