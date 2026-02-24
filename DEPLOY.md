# Deployment Guide

## Database migrations (required before first deploy / after schema changes)

**Run migrations before deploying new code** or the app may fail with errors like `column "plan" does not exist`.

### Local / production (using `DATABASE_URL`)

```bash
# Required: add users.plan and users.plan_expires_at (fixes login)
psql $DATABASE_URL -f migrations/0005_phase3_plan_tiers.sql

# Optional: indexes and timestamps (Phase 0)
psql $DATABASE_URL -f migrations/0003_phase0_indexes_constraints.sql
```

### Render

1. Open your Web Service → **Shell** tab, or use **Background Workers** / a one-off job.
2. Run:
   ```bash
   psql $DATABASE_URL -f migrations/0005_phase3_plan_tiers.sql
   ```
3. Or add a **Release Command** in Render dashboard:
   ```
   psql $DATABASE_URL -f migrations/0005_phase3_plan_tiers.sql
   ```

### Rollback (if needed)

```bash
psql $DATABASE_URL -c "ALTER TABLE users DROP COLUMN IF EXISTS plan; ALTER TABLE users DROP COLUMN IF EXISTS plan_expires_at;"
```

⚠️ After rollback, you must deploy code that does not reference `plan` (revert schema changes).
