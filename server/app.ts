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

  const frontendOrigin = process.env.FRONTEND_ORIGIN;
  if (frontendOrigin) {
    app.use(cors({ origin: frontendOrigin.split(",").map((o) => o.trim()), credentials: true }));
  }

  const PgStore = ConnectPgSimple(session);
  app.use(
    session({
      store: new PgStore({ pool, createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET || "fallback-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "0",
        sameSite: "lax",
      },
    })
  );

  app.use(requestContext);

  app.use(authRoutes);
  app.use(bbqRoutes);
  app.use(healthRoutes);

  app.use(errorHandler);

  return app;
}
