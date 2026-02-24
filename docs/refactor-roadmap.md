# Splanno Refactor & SaaS-Readiness Roadmap

**Version:** 1.0  
**Last updated:** 2025-02  
**Status:** In progress

---

## Executive Summary

This roadmap outlines a phased refactor to improve schema consistency, extract business logic from the UI, and lay foundations for SaaS monetization. Each phase is designed to be mergable independently with minimal risk.

---

## Current Pain Points (Identified)

| Area | Issue | Impact |
|------|-------|--------|
| **Schema** | `barbecues.creatorId`, `participants.userId`, `eventNotifications.userId` use `text` (username) while `users.id` is integer | Inconsistent joins, no FK integrity |
| **Schema** | Missing indexes on hot paths | Slow queries at scale |
| **Schema** | No unique constraints on participants per event, friendships | Duplicate data possible |
| **Schema** | `expenses` lacks `createdAt` | Poor auditability |
| **Frontend** | `home.tsx` ~2.1k lines, split logic inline | Hard to test, maintain |
| **Frontend** | `basic.tsx` duplicates split logic | Divergence risk |
| **Backend** | No centralized auth/authz layer | Scattered checks |
| **Monetization** | No plan/tier model | Cannot gate features |

---

## Phase 0: Safe Schema Improvements (Indexes + Constraints)

**Goal:** Add performance indexes and non-breaking constraints without data conversion.

### Scope
- Add indexes for frequent query paths
- Add unique constraints where safe
- Add `createdAt` to expenses (with default)
- Add `updatedAt` to barbecues (with default)

### Files Affected
- `shared/schema.ts` (Drizzle definitions)
- `migrations/0003_phase0_indexes_constraints.sql` (new)

### Indexes to Add
| Table | Column(s) | Rationale |
|-------|-----------|-----------|
| participants | barbecueId | List by event |
| expenses | barbecueId | List by event |
| expenses | participantId | Join participant→expenses |
| barbecues | creatorId | List by creator |
| friendships | requesterId | List by requester |
| friendships | addresseeId | List by addressee |
| password_reset_tokens | (userId, expiresAt) | Cleanup / lookup |

### Constraints to Add
- `friendships`: `UNIQUE(requester_id, addressee_id)` to prevent duplicate friend requests
- `friendships`: `CHECK(requester_id != addressee_id)` to prevent self-friending
- `participants`: `UNIQUE(barbecue_id, user_id)` where `user_id IS NOT NULL` (partial unique – may require PostgreSQL expression index; Phase 0 defers if complex)

### Risks
- Low. Indexes and new nullable columns with defaults are non-breaking.

### Rollback
- Drop indexes and new columns via reverse migration if needed.

### Expected Outcome
- Faster queries for barbecues, participants, expenses, friendships
- Cleaner data integrity for friendships
- Audit-friendly timestamps on expenses

---

## Phase 1: User ID Type Consistency Migration

**Goal:** Migrate `creatorId`, `participants.userId`, `eventNotifications.userId` from text (username) to integer FK (`users.id`).

### Current State
- `barbecues.creatorId`: text, stores `users.username`
- `participants.userId`: text, stores `users.username` when linked
- `eventNotifications.userId`: text, stores `users.username`

### Migration Plan (Two-Step)

#### Step 1.1: Add new columns, backfill
1. Add `barbecues.creator_user_id` (integer nullable, FK → users.id)
2. Add `participants.user_id_int` (integer nullable, FK → users.id)
3. Add `event_notifications.user_id_int` (integer nullable, FK → users.id)
4. Backfill from users table where `users.username = {old_column}`
5. Keep old columns for dual-write

#### Step 1.2: Switch over, drop old columns
1. Update all server code to use new columns
2. Update schema.ts
3. Drop old columns
4. Rename new columns to canonical names

### Files Affected
- `shared/schema.ts`
- `server/storage.ts`
- `server/routes.ts`
- `client/src/hooks/use-bbq-data.ts`, `use-participants.ts` (if API response shape changes)
- `migrations/0004_phase1_userid_migration.sql`

### Guest Participants
- `participants.userId` is nullable today. When null, `name` is used (guest).
- Migration: `participants.user_id_int` nullable. No CHECK needed if we keep `name` required and allow both (userId or guestName) – current model allows userId=null + name.

### Risks
- Medium. Requires careful backfill. Orphaned rows (username not in users) must be handled (e.g. creatorId for deleted users → set null or retain as broken reference).

### Rollback
- Keep old columns until Step 1.2 complete. Revert code to use old columns if issues arise.

### Expected Outcome
- All user references use integer FK to `users.id`
- Proper referential integrity
- Consistent types across codebase

---

## Phase 2: Split / Settlement Logic Refactor

**Goal:** Extract split/settlement business logic into pure, testable modules and split the home page UI into components.

### Scope

#### 2.1: Extract Business Logic
- **New module:** `client/src/lib/split/calc.ts` (or `splitCalculations.ts`)
- **Functions:**
  - `computeBalances(participants, expenses, expenseShares, allowOptIn): Balance[]`
  - `computeSettlementPlan(balances): Settlement[]`
  - `getFairShareForParticipant(participantId, expenses, expenseShares, participants, allowOptIn): number`
  - `getParticipantsInExpense(expenseId, expenseShares, participants, allowOptIn): number[]`
- **Tests:** Add `client/src/lib/split/calc.test.ts` or verification harness

#### 2.2: Split UI into Components
- **New components under `client/src/components/split/`:**
  - `SplitOverview` – contributions chart, total, fair share summary
  - `SettlementPlan` – settlement list with cards
  - `SettlementRow` / `SettlementCard` – single settlement
  - `IndividualContributions` – balance bars per person
- **Refactor `home.tsx`:** Compose these components, pass computed data as props
- **Refactor `basic.tsx`:** Use same `calc.ts` module to avoid duplication

### Files Affected
- `client/src/lib/split/calc.ts` (new)
- `client/src/lib/split/calc.test.ts` (new, or script)
- `client/src/components/split/SplitOverview.tsx` (new)
- `client/src/components/split/SettlementPlan.tsx` (new)
- `client/src/components/split/SettlementRow.tsx` (new)
- `client/src/components/split/IndividualContributions.tsx` (new)
- `client/src/pages/home.tsx` (refactor)
- `client/src/pages/basic.tsx` (refactor to use calc)

### Risks
- Low–medium. Logic extraction must preserve exact behavior (including opt-in expense shares).

### Rollback
- Revert component split; keep logic inline if needed.

### Expected Outcome
- Pure, typed, unit-testable split logic
- Smaller, focused React components
- No duplication between home and basic pages
- Same UX/behavior as before

---

## Phase 3: SaaS-Ready Auth & Monetization Foundation

**Goal:** Centralize authorization, add audit logging points, add plan/tier model for future feature gating.

### Scope

#### 3.1: Authorization Layer
- **New:** `server/middleware/requireAuth.ts` (or extend existing) – ensure user is logged in
- **New:** `server/lib/authz.ts` – `assertCanAccessBarbecue(userId, barbecueId)`, `assertIsCreator(userId, barbecue)`
- Apply to all BBQ/participant/expense/note routes

#### 3.2: Audit Logging
- **New:** `server/lib/audit.ts` – `auditLog(action, { userId, barbecueId, ... })`
- Implement as structured console.log for now; swappable to log provider
- Hook into: barbecue create/update/delete, settle-up, expense create/delete, participant add/remove, password reset usage

#### 3.3: Plan / Tier Model
- **Schema:** Add `users.plan` (text, default 'free'), `users.plan_expires_at` (timestamp nullable)
- **New:** `server/lib/features.ts` – `canUseFeature(user, 'multi_currency' | 'export_images' | 'unlimited_events')`
- Do NOT integrate payments yet; just structure code for future Stripe/Paddle

### Files Affected
- `shared/schema.ts` (users.plan, users.planExpiresAt)
- `server/middleware/requireAuth.ts` (new or extend)
- `server/lib/authz.ts` (new)
- `server/lib/audit.ts` (new)
- `server/lib/features.ts` (new)
- `server/routes.ts` (wire authz + audit)
- `migrations/0005_phase3_plan_tiers.sql`

### Risks
- Low. Additive changes. Feature gating returns true for all until tiers are implemented.

### Rollback
- Remove plan columns, revert route guards.

### Expected Outcome
- Clear authz boundaries
- Audit trail for critical actions
- Plan/tier model ready for future payment integration
- No behavior change for current users (all on 'free')

---

## Migration Execution

### How to Run Migrations
```bash
# Apply migrations manually (in order)
psql $DATABASE_URL -f migrations/0003_phase0_indexes_constraints.sql
# ... repeat for each phase migration
```

### Recommended Script
Add to `package.json`:
```json
"db:migrate": "node script/run-migrations.js"
```
Script should run SQL files in order, skip already-applied (e.g. track in `schema_migrations` table).

---

## Before/After Summary

| Area | Before | After |
|------|--------|-------|
| **Schema** | creatorId/userId as text (username), no indexes | Integer FKs, indexes, timestamps |
| **Split logic** | Inline in home.tsx, basic.tsx | Pure lib/split/calc.ts, testable |
| **Home page** | ~2.1k lines monolithic | Composed components, < 1k lines |
| **Auth** | Ad-hoc checks in routes | Centralized authz layer |
| **Audit** | None | Structured audit points |
| **Monetization** | None | users.plan + canUseFeature() |

---

## PR-Sized Steps (Suggested Order)

1. **PR 1:** Phase 0 migration + schema.ts updates (indexes, timestamps, friendship constraints)
2. **PR 2:** Phase 2.1 – Extract `client/src/lib/split/calc.ts` + tests
3. **PR 3:** Phase 2.2 – Split home.tsx into split/* components
4. **PR 4:** Phase 2.2 – Refactor basic.tsx to use calc
5. **PR 5:** Phase 3.1 – Authz layer + audit
6. **PR 6:** Phase 3.3 – Plan/tier schema + features.ts
7. **PR 7:** Phase 1 – User ID migration (larger, can be split into 1.1 and 1.2)

---

## Appendix: Schema Inconsistency Details

| Table | Column | Current Type | Issue | Target |
|-------|--------|--------------|-------|--------|
| barbecues | creatorId | text | Stores username | integer FK → users.id |
| participants | userId | text | Stores username | integer FK → users.id (nullable for guests) |
| event_notifications | userId | text | Stores username | integer FK → users.id |
| friendships | requesterId | integer | OK | — |
| friendships | addresseeId | integer | OK | — |
| password_reset_tokens | userId | integer | OK | — |
