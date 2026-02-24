# Deployment Guide

## Environment

- `.env` is **not committed** (in `.gitignore`). Render env vars are the source of truth in production.
- Do not commit secrets. Use Render's **Environment** tab for `DATABASE_URL`, `SESSION_SECRET`, etc.

### Security & CORS

| Variable | Description |
|----------|-------------|
| `FRONTEND_ORIGIN` | Comma-separated origins allowed by CORS (e.g. `https://app.example.com`). If unset, CORS middleware is not applied (same-origin only). |
| `SESSION_SECRET` | Required for signed session cookies. Use a strong random value. |

### Rate limiting

Auth endpoints are rate-limited to reduce brute-force risk:

| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/login` | 10 requests / minute |
| `POST /api/auth/forgot-password` | 5 requests / minute |
| `POST /api/auth/reset-password` | 5 requests / minute |

When exceeded, clients receive `429 Too Many Requests` with standard `Retry-After` header.

### Plan gating (monetization)

| Variable | Default | Description |
|----------|---------|-------------|
| `FREE_MAX_EVENTS` | `3` | Max events a free user can create. Pro users have unlimited. |
| `FREE_MAX_PARTICIPANTS` | `10` | Max participants per event for free plan. Pro users have unlimited. |
| `ADMIN_USERNAMES` | - | Comma-separated usernames for admin endpoints (e.g. `admin,jane`). Required to call `PATCH /api/admin/users/:id/plan`. |

---

## Production migrations

Run migrations **before** (or as part of) each deploy to avoid schema mismatch errors like `column "plan" does not exist`.

### Using the migration runner (recommended)

Uses `DATABASE_URL` and works with Supabase transaction pooler (port 6543).

```bash
# Check current schema version and connectivity
npm run db:check

# Apply all pending migrations
npm run db:migrate
```

For local runs against the pooler URL, ensure `DATABASE_URL` is set:

```bash
# Use quotes if the URL contains special chars (e.g. ! in password)
export DATABASE_URL='postgres://user:pass@host.pooler.supabase.com:6543/postgres'
npm run db:migrate
```

### On Render

Add a **Release Command** so migrations run on each deploy:

```
npm run db:migrate
```

Render sets `DATABASE_URL` from the env, so no extra config is needed.

To run migrations manually: Render → Web Service → **Shell** → `npm run db:migrate`.

### Verify after deploy

1. Open `https://your-app.onrender.com/api/health`
2. Expect: `ok: true`, `db.ok: true`, `schemaVersion` as a number
3. If `ok: false` or 503: migrations may not have run; check Release Command and logs

---

## Manual migrations (legacy)

If you prefer `psql` directly:

```bash
psql "$DATABASE_URL" -f migrations/0000_app_meta.sql
psql "$DATABASE_URL" -f migrations/0005_phase3_plan_tiers.sql
psql "$DATABASE_URL" -f migrations/0006_phaseD_indexes.sql
# ... etc, in order
```

---

## Rollback

For `plan` columns:

```bash
psql "$DATABASE_URL" -c "ALTER TABLE users DROP COLUMN IF EXISTS plan; ALTER TABLE users DROP COLUMN IF EXISTS plan_expires_at;"
```

After rollback, deploy code that does not reference `plan` (revert schema changes).
