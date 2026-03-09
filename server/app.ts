import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import path from "path";
import { pool } from "./db";
import { requestContext } from "./middleware/requestContext";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes";
import eventRoutes from "./routes/eventRoutes";
import participantRoutes from "./routes/participantRoutes";
import expenseRoutes from "./routes/expenseRoutes";
import chatRoutes from "./routes/chatRoutes";
import pollRoutes from "./routes/pollRoutes";
import friendRoutes from "./routes/friendRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import inboxRoutes from "./routes/inboxRoutes";
import noteRoutes from "./routes/noteRoutes";
import mediaRoutes from "./routes/mediaRoutes";
import publicEventRoutes from "./routes/publicEventRoutes";
import eventsRoutes from "./routes/eventsRoutes";
import healthRoutes from "./routes/healthRoutes";
import { bbqRepo } from "./repositories/bbqRepo";
import { participantRepo } from "./repositories/participantRepo";
import { userRepo } from "./repositories/userRepo";
import { resolveBaseUrl } from "./config/env";
import { loadJoinPreviewTemplate, renderJoinPreviewHtml } from "./lib/joinPreview";
import { log } from "./lib/logger";
import passport, { configurePassport } from "./lib/passport";

declare module "express-session" {
  interface SessionData {
    userId: number;
    username: string;
    oauthRedirectTo?: string;
  }
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function createApp() {
  const app = express();
  const publicSectionEnabled = process.env.FEATURE_PUBLIC_PLANS === "1" || process.env.ENABLE_PUBLIC_SECTION === "1";
  configurePassport();

  app.use(
    express.json({
      limit: "8mb",
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: unknown }).rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: false }));
  app.set("trust proxy", 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: false,
    })
  );

  const isProd = process.env.NODE_ENV === "production";
  const frontendOrigin = process.env.FRONTEND_ORIGIN;
  if (frontendOrigin) {
    app.use(cors({ origin: frontendOrigin.split(",").map((o) => o.trim()), credentials: true }));
  } else if (!isProd) {
    app.use(cors({ origin: true, credentials: true }));
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (isProd && (!sessionSecret || !sessionSecret.trim())) {
    throw new Error("SESSION_SECRET must be set in production");
  }

  const PgStore = ConnectPgSimple(session);
  app.use(
    session({
      store: new PgStore({ pool, createTableIfMissing: true }),
      secret: sessionSecret || "fallback-secret-change-me",
      resave: false,
      saveUninitialized: false,
      name: "splanno.sid",
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: isProd && process.env.COOKIE_SECURE !== "0",
        sameSite: "lax",
      },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  app.use(requestContext);

  // Uploaded assets must be directly browser-loadable in both dev and prod.
  app.use(
    "/uploads",
    express.static(path.resolve(process.cwd(), "public/uploads"), {
      maxAge: "1y",
      immutable: true,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("Access-Control-Allow-Origin", "*");
      },
    }),
  );

  // Temporary feature lock: disable public/explore surfaces while private UX is being polished.
  if (!publicSectionEnabled) {
    app.use((req, res, next) => {
      const path = req.path || "";
      const isPublicApiPath =
        path.startsWith("/api/explore/") ||
        path.startsWith("/api/public/") ||
        path.startsWith("/api/public-events/") ||
        path.startsWith("/api/public-profile/");
      if (!isPublicApiPath) return next();
      return res.status(410).json({
        code: "PUBLIC_DISABLED",
        message: "Public section is temporarily disabled",
      });
    });
  }

  // Legacy aggregate endpoint (/all) for older deployed clients.
  // Fail-soft: partial slices return defaults + errors metadata instead of 500.
  app.get("/all", async (req, res) => {
    const startedAt = Date.now();
    const reqId = (req as express.Request & { requestId?: string }).requestId;
    const sessionUserId = req.session?.userId;
    const sessionUsername = req.session?.username;
    if (!sessionUsername) {
      return res.status(401).json({ code: "UNAUTHORIZED", message: "Authentication required" });
    }

    const sliceErrors: Array<{ slice: string; code: "SLICE_FAILED" }> = [];
    try {
      const results = await Promise.allSettled([
        bbqRepo.listAccessible(sessionUsername, sessionUserId),
        sessionUserId ? participantRepo.getAllPendingRequestsForCreator(sessionUserId) : Promise.resolve([]),
        sessionUserId ? userRepo.findById(sessionUserId) : Promise.resolve(null),
      ]);

      const [eventsResult, requestsResult, userResult] = results;

      const events = eventsResult.status === "fulfilled" ? (eventsResult.value ?? []) : [];
      if (eventsResult.status === "rejected") {
        sliceErrors.push({ slice: "events", code: "SLICE_FAILED" });
        log("error", "Legacy /all slice failed", {
          reqId,
          route: "/all",
          slice: "events",
          userId: sessionUserId,
          username: sessionUsername,
          errorName: eventsResult.reason instanceof Error ? eventsResult.reason.name : "Error",
          errorMessage: eventsResult.reason instanceof Error ? eventsResult.reason.message : String(eventsResult.reason),
          stack: eventsResult.reason instanceof Error ? eventsResult.reason.stack : undefined,
        });
      }

      const requests = requestsResult.status === "fulfilled" ? (requestsResult.value ?? []) : [];
      if (requestsResult.status === "rejected") {
        sliceErrors.push({ slice: "requests", code: "SLICE_FAILED" });
        log("error", "Legacy /all slice failed", {
          reqId,
          route: "/all",
          slice: "requests",
          userId: sessionUserId,
          username: sessionUsername,
          errorName: requestsResult.reason instanceof Error ? requestsResult.reason.name : "Error",
          errorMessage: requestsResult.reason instanceof Error ? requestsResult.reason.message : String(requestsResult.reason),
          stack: requestsResult.reason instanceof Error ? requestsResult.reason.stack : undefined,
        });
      }

      const user = userResult.status === "fulfilled" ? (userResult.value ?? null) : null;
      if (userResult.status === "rejected") {
        sliceErrors.push({ slice: "user", code: "SLICE_FAILED" });
        log("error", "Legacy /all slice failed", {
          reqId,
          route: "/all",
          slice: "user",
          userId: sessionUserId,
          username: sessionUsername,
          errorName: userResult.reason instanceof Error ? userResult.reason.name : "Error",
          errorMessage: userResult.reason instanceof Error ? userResult.reason.message : String(userResult.reason),
          stack: userResult.reason instanceof Error ? userResult.reason.stack : undefined,
        });
      }

      return res.json({
        events,
        barbecues: events,
        requests,
        user,
        errors: sliceErrors,
      });
    } catch (err) {
      const elapsedMs = Date.now() - startedAt;
      log("error", "Legacy /all endpoint failed", {
        reqId,
        route: "/all",
        userId: sessionUserId,
        username: sessionUsername,
        errorName: err instanceof Error ? err.name : "Error",
        errorMessage: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        elapsedMs,
      });
      return res.status(500).json({ code: "ALL_ENDPOINT_FAILED", message: "Failed to load dashboard data" });
    } finally {
      const elapsedMs = Date.now() - startedAt;
      log("info", "Legacy /all completed", {
        reqId,
        route: "/all",
        userId: sessionUserId,
        username: sessionUsername,
        elapsedMs,
      });
    }
  });

  app.use("/api", authRoutes);
  app.use("/api", chatRoutes);
  app.use("/api/events", eventsRoutes);
  app.use("/api", eventRoutes);
  app.use("/api", participantRoutes);
  app.use("/api", expenseRoutes);
  app.use("/api", pollRoutes);
  app.use("/api", friendRoutes);
  app.use("/api", notificationRoutes);
  app.use("/api", inboxRoutes);
  app.use("/api", noteRoutes);
  app.use("/api", mediaRoutes);
  app.use("/api", publicEventRoutes);
  app.use("/api", healthRoutes);

  app.get("/join/:token", async (req, res, next) => {
    try {
      const token = String(req.params.token ?? "").trim();
      const invite = token ? await participantRepo.getBarbecueByToken(token) : null;
      const creator = invite?.creatorUserId ? await userRepo.findById(invite.creatorUserId) : null;
      const inviterName = creator?.displayName || creator?.username || "Someone";
      const planName = invite?.name || "your plan";
      const baseUrl = resolveBaseUrl(`${req.protocol}://${req.get("host") || ""}`);
      const template = await loadJoinPreviewTemplate();
      const html = renderJoinPreviewHtml(template, {
        title: "You're invited to a plan on Splann-O",
        description: `${inviterName} invited you to join ${planName}. Open the plan, chat with the group, and stay in sync.`,
        imageUrl: `${baseUrl}/branding/splann-o-og-image.svg`,
        url: `${baseUrl}/join/${encodeURIComponent(token)}`,
        siteName: "Splann-O",
      });

      res
        .status(200)
        .set({
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        })
        .send(html);
    } catch (error) {
      next(error);
    }
  });

  if (!isProd) {
    app.use((req, res, next) => {
      if (req.originalUrl.startsWith("/api/")) {
        console.warn("[404]", req.method, req.originalUrl);
        return res.status(404).json({ code: "NOT_FOUND", message: "Not found" });
      }
      next();
    });
  }

  app.use(errorHandler);

  return app;
}
