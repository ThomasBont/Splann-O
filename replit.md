# replit.md

## Overview

BBQ Expense Tracker is a full-stack web application for tracking barbecue event expenses. Users register with username, email, display name and password (server-side sessions). Can create public or private BBQ events with name/date/currency. Public BBQs are visible to all and joinable via request/approval. Private BBQs are invite-only (creator invites by username). Accepted participants can add their own expenses. Supports multiple currencies (EUR, USD, ARS, GBP, MXN) with approximate conversion bar. Four UI languages (English, Spanish, Italian, Dutch) via tab selector. Password reset via email (or server log fallback).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router). Routes: `/` (Home), `/reset-password?token=...` (ResetPassword page)
- **State Management**: TanStack React Query for server state; React Context for language/i18n
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives with Tailwind CSS
- **Charts**: Recharts for expense breakdown pie charts
- **Animations**: Framer Motion for transitions
- **Styling**: Tailwind CSS with CSS variables for theming (dark theme with gold/orange accent colors inspired by BBQ aesthetics). Custom fonts: Playfair Display (display) and DM Sans (body)
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend
- **Framework**: Express 5 on Node.js with TypeScript (compiled via tsx in dev, esbuild for production)
- **API Pattern**: RESTful JSON API under `/api/` prefix. Route definitions are shared between client and server via `shared/routes.ts`
- **Server Setup**: HTTP server created with `createServer()`. In development, Vite middleware handles HMR and serves the client. In production, static files are served from `dist/public/`

### Data Storage
- **Database**: PostgreSQL via `DATABASE_URL` environment variable
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-validation integration
- **Schema** (in `shared/schema.ts`):
  - `users` — id, username (unique), email (unique), displayName, passwordHash, createdAt
  - `password_reset_tokens` — id, token (unique), userId (FK → users, cascade delete), expiresAt, usedAt
  - `barbecues` — id, name, date, currency, creatorId (nullable text, username of creator), isPublic (boolean, default true)
  - `participants` — id, barbecueId (FK → barbecues, cascade delete), name, userId (nullable text, username), status ("accepted" | "pending" | "invited", default "accepted")
  - `expenses` — id, barbecueId (FK → barbecues, cascade delete), participantId (FK → participants, cascade delete), category, item, amount (numeric 10,2)
- **Migrations**: Schema pushed via raw SQL (ALTER TABLE) and drizzle-kit. Use `npm run db:push` for future changes.

### Authentication System
- **Backend**: `bcryptjs` for password hashing (10 rounds), `express-session` + `connect-pg-simple` for PostgreSQL-backed sessions
- **Session**: 30-day cookie, httpOnly, SESSION_SECRET environment variable required
- **Endpoints**: POST /api/auth/register (requires username, email, displayName?, password), POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me, POST /api/auth/forgot-password, POST /api/auth/reset-password
- **Frontend**: `useAuth()` hook in `client/src/hooks/use-auth.tsx` — queries /api/auth/me on mount, provides user info + login/register/logout/forgotPassword/resetPassword mutations
- **Auth dialog**: Shown when not logged in (non-dismissible modal with Login/Register/ForgotPassword/Sent views)
- **AuthUser type**: `{ id, username, email, displayName | null }`

### Password Reset Flow
- User clicks "Forgot password?" in login view → enters email → POST /api/auth/forgot-password
- Server creates token (1 hour TTL) in password_reset_tokens table, sends email via Resend (or logs URL if no API key)
- User visits `/reset-password?token=...` → enters new password → POST /api/auth/reset-password
- **Email sending**: `server/email.ts` — uses `RESEND_API_KEY` env var. If not set, falls back to logging the reset URL to the server console.
- **NOTE**: Resend integration was dismissed by user. To enable email: set `RESEND_API_KEY` as an environment secret manually, OR connect the Resend integration later. Without it, the app still works — reset links appear in server logs.

### BBQ UI
- BBQ list is a **compact horizontal scrollable strip** below the header (not a grid). BBQ chips show name, creator crown, private lock icon, status dots.
- Clicking a chip selects/deselects the BBQ, showing its details in the main area below.
- "+ New Barbecue" button at end of strip.
- Join/Accept invite/Decline buttons appear inline in the strip per-chip.

### BBQ Visibility System
- **Public BBQs**: Visible to all users, anyone can click "Join" → creates pending participant → creator accepts/rejects
- **Private BBQs**: Only visible to creator and participants (any status). Creator invites by username → creates "invited" participant. Invited user sees Accept/Decline inline in the BBQ strip.
- **Participant statuses**: "accepted" (full member), "pending" (join request awaiting approval), "invited" (private BBQ invite pending)
- **Expense permissions**: Creator AND accepted participants can add expenses. Edit/delete controls on expense rows.

### Currency Conversion Bar
- Shows total spent and fair share in all 5 currencies
- Uses static approximate exchange rates (EUR as base: USD 1.08, ARS 1050, GBP 0.85, MXN 18.0)
- `convertCurrency(amount, from, to)` utility in `use-language.tsx`
- Displayed as horizontal scrollable card row (visible when total > 0)

### Language Selector
- 4 tab buttons inline in header: EN | ES | IT | NL
- `LANGUAGES` array exported from `use-language.tsx`
- Translations for all features (auth, visibility, invite, forgot password) in all 4 languages

### API Structure
All routes defined in `shared/routes.ts` with Zod schemas for input validation:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/auth/me` | Get current session user |
| POST | `/api/auth/register` | Register new user (username, email, displayName?, password) |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout (destroy session) |
| POST | `/api/auth/forgot-password` | Request password reset email |
| POST | `/api/auth/reset-password` | Reset password with token |
| GET | `/api/barbecues` | List BBQs (filtered by privacy for current session user) |
| POST | `/api/barbecues` | Create a BBQ event |
| GET | `/api/barbecues/:id` | Get single BBQ |
| DELETE | `/api/barbecues/:id` | Delete BBQ (cascades) |
| GET | `/api/barbecues/:bbqId/participants` | List accepted participants |
| POST | `/api/barbecues/:bbqId/participants` | Add participant (creator only, auto-accepted) |
| GET | `/api/barbecues/:bbqId/pending` | List pending join requests |
| GET | `/api/barbecues/:bbqId/invited` | List invited participants |
| POST | `/api/barbecues/:bbqId/join` | Request to join (creates pending participant) |
| POST | `/api/barbecues/:bbqId/invite` | Invite user by username (creates invited participant) |
| PATCH | `/api/participants/:id/accept` | Accept a join request or invitation |
| DELETE | `/api/participants/:id` | Remove/reject participant |
| GET | `/api/memberships?userId=x` | Get all memberships for a user |
| GET | `/api/barbecues/:bbqId/expenses` | List expenses (with participant name) |
| POST | `/api/barbecues/:bbqId/expenses` | Add expense |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |

### Languages
Supported: **English (EN)**, **Spanish (ES)**, **Italian (IT)**, **Dutch (NL)**. Language selected via 4 tab buttons in header.

### Shared Code Pattern
The `shared/` directory contains code used by both client and server:
- `schema.ts` — Drizzle table definitions, Zod insert schemas, TypeScript types
- `routes.ts` — API route definitions with paths, methods, Zod input/output schemas, and a `buildUrl` helper for parameterized paths

### Build Process
- **Dev**: `tsx server/index.ts` runs the server with Vite middleware for HMR
- **Production build**: `script/build.ts` runs Vite build for client → `dist/public/`, then esbuild for server → `dist/index.cjs`. Selected dependencies are bundled to reduce cold start syscalls
- **Production start**: `node dist/index.cjs`

## External Dependencies

### Required Services
- **PostgreSQL**: Required. Connection via `DATABASE_URL` environment variable. Used with `pg` (node-postgres) Pool and Drizzle ORM
- **Sessions**: `express-session` + `connect-pg-simple` for PostgreSQL-backed session storage. Requires `SESSION_SECRET` env var.

### Optional Services
- **Resend** (email): Set `RESEND_API_KEY` env secret to enable real password-reset emails. Without it, reset URLs are printed to the server log. The Resend integration was dismissed — to re-enable, either use the Replit integrations panel to connect Resend, or add `RESEND_API_KEY` manually as a secret.

### Key npm Packages
- **drizzle-orm** + **drizzle-kit** + **drizzle-zod**: ORM, migration tooling, and schema-to-Zod bridge
- **express** v5: HTTP server framework
- **express-session** + **connect-pg-simple**: Session management
- **bcryptjs**: Password hashing
- **@tanstack/react-query**: Async server state management
- **recharts**: Charting library for expense visualizations
- **framer-motion**: Animation library
- **wouter**: Lightweight React router
- **zod**: Runtime validation (shared between client and server)
- **shadcn/ui ecosystem**: Radix UI primitives, class-variance-authority, tailwind-merge, clsx, lucide-react icons

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal`: Error overlay in development
- `@replit/vite-plugin-cartographer` and `@replit/vite-plugin-dev-banner`: Dev-only Replit integrations (conditionally loaded)
