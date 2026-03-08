import { Router } from "express";
import { pool } from "../db";
import { parseDbUrl } from "../lib/db-utils";

const router = Router();

router.get("/health", async (_req, res) => {
  res.setHeader("Cache-Control", "private, max-age=30");
  const timestamp = new Date().toISOString();
  const commit = process.env.RENDER_GIT_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  const buildId = process.env.BUILD_ID ?? process.env.VITE_BUILD_ID ?? commit ?? null;
  const parsed = process.env.DATABASE_URL ? parseDbUrl(process.env.DATABASE_URL) : null;
  const dbInfo = {
    host: parsed?.host ?? null,
    port: parsed?.port ?? null,
    user: parsed?.user ?? null,
    database: parsed?.database ?? null,
  };

  try {
    const result = await pool.query("SELECT schema_version FROM app_meta WHERE id = 1");
    const schemaVersion = result.rows[0]?.schema_version ?? 0;
    res.json({
      ok: true,
      db: { ok: true, ...dbInfo },
      schemaVersion,
      commit,
      buildId,
      timestamp,
    });
  } catch {
    res.status(503).json({
      ok: false,
      db: { ok: false, ...dbInfo },
      schemaVersion: null,
      commit,
      buildId,
      timestamp,
    });
  }
});

export default router;
