import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const buildId = process.env.BUILD_ID || process.env.VITE_BUILD_ID || "unknown";
  // Serve repo root /public folder if present
  const rootPublicPath = path.resolve(process.cwd(), "public");
  app.use(express.static(rootPublicPath, { index: false }));

  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const distAssetsPath = path.resolve(distPath, "assets");
  app.use(
    "/assets",
    express.static(distAssetsPath, {
      immutable: true,
      maxAge: "1y",
      index: false,
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.setHeader("X-Build-Id", buildId);
      },
    }),
  );

  app.use(
    express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-store");
        }
        res.setHeader("X-Build-Id", buildId);
      },
    }),
  );

  app.get("/", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Build-Id", buildId);
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  // SPA fallback
  app.get("/{*splat}", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Build-Id", buildId);
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
