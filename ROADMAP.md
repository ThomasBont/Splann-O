# Splanno Refactor Roadmap

See **[docs/refactor-roadmap.md](./docs/refactor-roadmap.md)** for the full phased plan, schema details, and migration notes.

## Quick Summary

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 0** | ✅ Done | Indexes, constraints, timestamps |
| **Phase 1** | 📋 Planned | User ID type consistency (text → integer FK) |
| **Phase 2** | ✅ Done | Split logic extraction + components |
| **Phase 3** | ✅ Done | Authz layer, audit logging, plan/tier model |

## Run Migrations

```bash
# Apply Phase 0 (indexes, expenses.createdAt, barbecues.updatedAt)
psql $DATABASE_URL -f migrations/0003_phase0_indexes_constraints.sql

# Apply Phase 3 (users.plan, users.planExpiresAt)
psql $DATABASE_URL -f migrations/0005_phase3_plan_tiers.sql
```

## Verify Split Logic

```bash
npm run split:verify
```

## Files Changed (This Pass)

### New Files
- `docs/refactor-roadmap.md` – Full roadmap
- `client/src/lib/split/calc.ts` – Pure split/settlement logic
- `client/src/lib/split/calc.verify.ts` – Verification harness
- `client/src/components/split/IndividualContributions.tsx`
- `client/src/components/split/SettlementPlan.tsx`
- `server/lib/authz.ts` – assertCanAccessBarbecue, assertIsCreator
- `server/lib/audit.ts` – auditLog for critical actions
- `server/lib/features.ts` – canUseFeature for plan gating
- `migrations/0003_phase0_indexes_constraints.sql`
- `migrations/0005_phase3_plan_tiers.sql`

### Modified Files
- `shared/schema.ts` – expenses.createdAt, barbecues.updatedAt, users.plan/planExpiresAt
- `client/src/pages/home.tsx` – Uses calc + split components
- `package.json` – split:verify script
