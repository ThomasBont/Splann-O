import express, { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server as HttpServer } from "http";
import { type Server as HttpsServer } from "https";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { resolveDevServerHost, shouldUseDevHttps } from "./config/env";

const viteLogger = createLogger();

export async function setupVite(server: HttpServer | HttpsServer, app: Express) {
  const buildId = process.env.BUILD_ID || process.env.VITE_BUILD_ID || "dev";
  app.use(express.static(path.resolve(process.cwd(), "public"), { index: false }));
  const devHost = resolveDevServerHost() || undefined;
  const devHttps = shouldUseDevHttps();

  const serverOptions = {
    host: true,
    middlewareMode: true,
    hmr: {
      server,
      path: "/vite-hmr",
      host: devHost,
      protocol: devHttps ? "wss" : "ws",
    },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  // SPA fallback: serve index.html for any path (named wildcard for path-to-regexp)
  app.get("/{*splat}", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res
        .status(200)
        .set({
          "Content-Type": "text/html",
          "Cache-Control": "no-store",
          "X-Build-Id": buildId,
        })
        .end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
