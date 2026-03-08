# Deployment Guide

## Environment

- `.env` is **not committed** (in `.gitignore`). Render env vars are the source of truth in production.
- Do not commit secrets. Use Render's **Environment** tab for `DATABASE_URL`, `SESSION_SECRET`, etc.

### Custom domain env vars

Set these in Render for the production domain:

| Variable | Value |
|----------|-------|
| `BASE_URL` | `https://splanno.app` |
| `VITE_PUBLIC_APP_ORIGIN` | `https://splanno.app` |

Use `BASE_URL` for server-side URL generation such as OAuth callbacks, invite links, email links, and Stripe redirects.
Use `VITE_PUBLIC_APP_ORIGIN` for client-side invite link generation.

### Security & CORS

| Variable | Description |
|----------|-------------|
| `FRONTEND_ORIGIN` | Comma-separated origins allowed by CORS (e.g. `https://app.example.com`). If unset, CORS middleware is not applied (same-origin only). |
| `SESSION_SECRET` | Required for signed session cookies. Use a strong random value. |

### Rate limiting

Auth endpoints are rate-limited to reduce brute-force risk:

| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/register` | 10 requests / minute |
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
| `BETA_MODE` | - | Set to `1` to unlock Pro features for all logged-in users (no DB changes). Keeps paywall code intact for future monetization. |

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

### GitHub Actions deploy trigger

This repo now includes a GitHub Actions workflow at `.github/workflows/render-deploy.yml`.

On every push to `main`, it will:

1. install dependencies
2. run `npm run check`
3. run `npm run build`
4. trigger Render via a deploy hook

To enable it:

1. In Render, open your web service
2. Go to `Settings` → `Deploy Hook`
3. Create a new deploy hook
4. Copy the hook URL
5. In GitHub, open `Settings` → `Secrets and variables` → `Actions`
6. Add a repository secret named `RENDER_DEPLOY_HOOK_URL`
7. Paste the Render deploy hook URL as the value

If this secret is missing, the workflow will fail explicitly instead of silently skipping deploys.

### Recommended Render deploy settings

- Service branch: `main`
- Build Command: `npm run build`
- Start Command: `npm start`
- Release Command: `npm run db:migrate`

This keeps the live service aligned with the same build output that is validated in CI.

### Custom domain

DNS configuration for `splanno.app`:

- In your domain registrar, add a CNAME record:
  - Name: `@` (or `www`)
  - Value: `your-render-service.onrender.com`
- In Render dashboard: `Settings` → `Custom Domains` → add `splanno.app`
- SSL certificate will be provisioned automatically by Render

### Google OAuth

In Google Cloud Console, keep both authorized callback URLs:

- `https://splanno.app/api/auth/google/callback`
- `https://ortega-asado-tracker.onrender.com/api/auth/google/callback`

### Verify after deploy

1. Open `https://your-app.onrender.com/api/health`
2. Expect: `ok: true`, `db.ok: true`, `schemaVersion` as a number
3. Check `commit` and `buildId` to confirm the live app matches the latest deploy
4. If `ok: false` or 503: migrations may not have run; check Release Command and logs

---

## Manual migrations (legacy)

If you prefer `psql` directly:

```bash
psql "$DATABASE_URL" -f migrations/0000_app_meta.sql
psql "$DATABASE_URL" -f migrations/0005_phase3_plan_tiers.sql
psql "$DATABASE_URL" -f migrations/0006_phaseD_indexes.sql
psql "$DATABASE_URL" -f migrations/0007_phase1_invited_user_id.sql
# ... etc, in order
```

---

## Rollback

For `plan` columns:

```bash
psql "$DATABASE_URL" -c "ALTER TABLE users DROP COLUMN IF EXISTS plan; ALTER TABLE users DROP COLUMN IF EXISTS plan_expires_at;"
```

After rollback, deploy code that does not reference `plan` (revert schema changes).

## Verify after deploy

- `https://splanno.app` loads correctly
- `https://splanno.app/api/health` reports the expected `commit` and `buildId`
- `https://splanno.app/join/[token]` works for invite links
- Google OAuth login works on `splanno.app`
- Invite links generated in the app use `splanno.app` instead of the Render domain
