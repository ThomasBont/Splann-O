import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { requestContext } from "./middleware/requestContext";
import { errorHandler } from "./middleware/errorHandler";
import authRoutes from "./routes/authRoutes";
import bbqRoutes from "./routes/bbqRoutes";
import healthRoutes from "./routes/healthRoutes";

declare module "express-session" {
  interface SessionData {
    userId: number;
    username: string;
  }
}

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function createApp() {
  const app = express();

  app.use(
    express.json({
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

  app.use(requestContext);

  app.use("/api", authRoutes);
  app.use("/api", bbqRoutes);
  app.use("/api", healthRoutes);

  app.use(errorHandler);

  return app;
}
