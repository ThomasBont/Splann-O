# Migrations

SQL migrations run in filename order. The migration runner tracks applied versions in `app_meta.schema_version`.

```bash
npm run db:check   # Current schema version + connectivity
npm run db:migrate # Apply pending migrations
```

Uses `DATABASE_URL`. Compatible with Supabase transaction pooler (port 6543).
