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
import { and, eq } from "drizzle-orm";
import { barbecues, eventMembers, users, session as sessionTable } from "@shared/schema";
import { createHmac, timingSafeEqual } from "crypto";
import { appendEventChatMessage } from "./lib/eventChatStore";
import { broadcastEventRealtime, registerEventSocket, unregisterEventSocket } from "./lib/eventRealtime";
import { isEventChatLocked } from "./lib/eventChatPolicy";

const runtimeBuildId =
  process.env.BUILD_ID
  || process.env.VITE_BUILD_ID
  || process.env.RENDER_GIT_COMMIT?.slice(0, 12)
  || process.env.GITHUB_SHA?.slice(0, 12)
  || `dev-${Date.now()}`;
process.env.BUILD_ID = runtimeBuildId;
process.env.VITE_BUILD_ID = process.env.VITE_BUILD_ID || runtimeBuildId;

const app = createApp();
const httpServer = createServer(app);
const chatWss = new WebSocketServer({ noServer: true });

type WsClientMeta = {
  eventId: number;
  userId: number;
  username: string;
  subscribed: boolean;
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

async function canAccessEventChat(eventId: number, user: { id: number; username: string }): Promise<boolean> {
  const [eventRow] = await db.select({ creatorId: barbecues.creatorId }).from(barbecues).where(eq(barbecues.id, eventId)).limit(1);
  if (!eventRow) return false;
  if (eventRow.creatorId === user.username) {
    await db.insert(eventMembers).values({
      eventId,
      userId: user.id,
      role: "owner",
      joinedAt: new Date(),
    }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] });
    return true;
  }

  const [memberRow] = await db
    .select({ id: eventMembers.id })
    .from(eventMembers)
    .where(and(eq(eventMembers.eventId, eventId), eq(eventMembers.userId, user.id)))
    .limit(1);
  if (memberRow) return true;

  // Heal legacy owner rows where username exists but session may be stale.
  if (!eventRow.creatorId) return false;
  const [ownerUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, eventRow.creatorId))
    .limit(1);
  if (ownerUser && ownerUser.id === user.id) {
    await db.insert(eventMembers).values({
      eventId,
      userId: user.id,
      role: "owner",
      joinedAt: new Date(),
    }).onConflictDoNothing({ target: [eventMembers.eventId, eventMembers.userId] });
    return true;
  }
  return false;
}

async function isEventChatLockedById(eventId: number): Promise<boolean> {
  const [eventRow] = await db
    .select({ date: barbecues.date })
    .from(barbecues)
    .where(eq(barbecues.id, eventId))
    .limit(1);
  if (!eventRow) return false;
  return isEventChatLocked({ date: eventRow.date ?? null });
}

chatWss.on("connection", (ws, req) => {
  const meta = (req as import("http").IncomingMessage & { chatMeta?: WsClientMeta }).chatMeta;
  if (!meta) {
    ws.close(1008, "unauthorized");
    return;
  }
  ws.send(JSON.stringify({ type: "hello", eventId: meta.eventId }));

  ws.on("message", (raw: RawData) => {
    let parsed: {
      type?: string;
      text?: string;
      content?: string;
      clientMessageId?: string;
      eventId?: number;
      user?: { id?: string | number; name?: string };
    } | null = null;
    try {
      parsed = JSON.parse(String(raw));
    } catch {
      ws.send(JSON.stringify({ type: "error", code: "VALIDATION_ERROR", message: "Invalid payload" }));
      return;
    }

    if (parsed?.type === "event:subscribe") {
      const requestedEventId = Number(parsed.eventId ?? meta.eventId);
      if (!Number.isFinite(requestedEventId) || requestedEventId !== meta.eventId) {
        ws.send(JSON.stringify({ type: "event:error", code: "CHAT_LOCKED", eventId: meta.eventId }));
        return;
      }
      canAccessEventChat(meta.eventId, { id: meta.userId, username: meta.username })
        .then((allowed) => {
          if (!allowed) {
            ws.send(JSON.stringify({ type: "event:error", code: "CHAT_LOCKED", eventId: meta.eventId }));
            return;
          }
          if (!meta.subscribed) {
            registerEventSocket(meta.eventId, ws);
            meta.subscribed = true;
          }
          ws.send(JSON.stringify({ type: "event:subscribed", eventId: meta.eventId }));
          isEventChatLockedById(meta.eventId)
            .then((locked) => {
              if (!locked) return;
              ws.send(JSON.stringify({ type: "event:chat_locked", code: "CHAT_LOCKED", eventId: meta.eventId }));
            })
            .catch(() => {
              // Ignore lock-state fetch errors; subscription still valid.
            });
        })
        .catch(() => {
          ws.send(JSON.stringify({ type: "event:error", code: "INTERNAL_ERROR", eventId: meta.eventId }));
        });
      return;
    }
    if (parsed?.type === "typing") {
      if (!meta.subscribed) return;
      broadcastEventRealtime(meta.eventId, {
        type: "chat:typing",
        eventId: meta.eventId,
        user: {
          id: String(meta.userId),
          name: meta.username,
        },
      });
      return;
    }
    if (parsed?.type !== "send" && parsed?.type !== "chat:send") return;
    if (!meta.subscribed) {
      ws.send(JSON.stringify({ type: "event:error", code: "CHAT_LOCKED", eventId: meta.eventId }));
      return;
    }
    const textRaw = typeof parsed.content === "string" ? parsed.content : (typeof parsed.text === "string" ? parsed.text : "");
    const text = textRaw.trim();
    if (!text) return;
    if (text.length > 2000) {
      ws.send(JSON.stringify({ type: "error", code: "VALIDATION_ERROR", message: "Message too long" }));
      return;
    }
    const clientMessageId = typeof parsed.clientMessageId === "string" ? parsed.clientMessageId.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientMessageId)) {
      ws.send(JSON.stringify({ type: "chat:error", code: "VALIDATION_ERROR", clientMessageId: clientMessageId || null, message: "Invalid clientMessageId" }));
      return;
    }

    canAccessEventChat(meta.eventId, { id: meta.userId, username: meta.username })
      .then(async (allowed) => {
        if (!allowed) {
          ws.send(JSON.stringify({ type: "error", code: "NOT_AUTHORIZED", message: "Membership required" }));
          return;
        }
        const locked = await isEventChatLockedById(meta.eventId);
        if (locked) {
          ws.send(JSON.stringify({ type: "event:error", code: "CHAT_LOCKED", eventId: meta.eventId }));
          return;
        }
        const result = await appendEventChatMessage(meta.eventId, {
          type: "user",
          text,
          clientMessageId,
          user: { id: String(meta.userId), name: meta.username },
        });
        if (result.inserted) {
          broadcastEventRealtime(meta.eventId, { type: "chat:new", message: result.message });
          // Backward compatibility for older clients.
          broadcastEventRealtime(meta.eventId, { type: "message", message: result.message });
        }
        ws.send(JSON.stringify({ type: "chat:ack", clientMessageId, message: result.message }));
      })
      .catch(() => {
        ws.send(JSON.stringify({ type: "chat:error", code: "INTERNAL_ERROR", clientMessageId, message: "Message failed" }));
      });
  });

  ws.on("close", () => {
    if (meta.subscribed) {
      unregisterEventSocket(meta.eventId, ws);
      meta.subscribed = false;
    }
  });
});

httpServer.on("upgrade", async (req, socket, head) => {
  try {
    const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
    const forwardedHost = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim();
    const host = forwardedHost || req.headers.host || "0.0.0.0";
    const protocol = forwardedProto || "http";
    const url = new URL(req.url ?? "", `${protocol}://${host}`);
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
    (req as import("http").IncomingMessage & { chatMeta?: WsClientMeta }).chatMeta = {
      eventId,
      userId: user.id,
      username: user.username,
      subscribed: false,
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
