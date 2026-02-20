# replit.md

## Overview

BBQ Expense Tracker is a full-stack web application for tracking barbecue event expenses. Users create a username (stored in localStorage), can create barbecue events or join events created by others. Each event has a name, date, and currency. Participants and expenses are tracked per event. The app supports multiple currencies (EUR, USD, ARS, GBP, MXN) and four UI languages (English, Spanish, Italian, Dutch).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript, bundled by Vite
- **Routing**: Wouter (lightweight client-side router)
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
  - `barbecues` — id, name, date, currency, creatorId (nullable text, username of creator)
  - `participants` — id, barbecueId (FK → barbecues, cascade delete), name, userId (nullable text, username), status ("accepted" | "pending", default "accepted")
  - `expenses` — id, barbecueId (FK → barbecues, cascade delete), participantId (FK → participants, cascade delete), category, item, amount (numeric 10,2)
- **Migrations**: Managed via `drizzle-kit push` (schema push approach, not migration files)

### User Identity System
- **Storage**: Username stored in `localStorage` under key `bbq-username`
- **Hook**: `client/src/hooks/use-user.tsx` provides `username`, `setUsername`, `clearUsername`
- **First-time UX**: On first visit (no username in localStorage), a modal dialog prompts for a username
- **Creator**: When creating a BBQ, `creatorId` is set to the current username
- **Join flow**:
  1. Non-creator clicks "Join" on a BBQ card → creates a `pending` participant record
  2. Creator sees a yellow panel with pending requests; can Accept or Reject
  3. Accepted participants appear in the main participant list and can log expenses
  4. Participants can leave their own BBQ (if BBQ date >= today) via the "Leave" button on their chip
- **Memberships**: `GET /api/memberships?userId=x` returns all BBQs and statuses for a user

### API Structure
All routes defined in `shared/routes.ts` with Zod schemas for input validation:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/barbecues` | List all BBQ events |
| POST | `/api/barbecues` | Create a BBQ event |
| GET | `/api/barbecues/:id` | Get single BBQ |
| DELETE | `/api/barbecues/:id` | Delete BBQ (cascades) |
| GET | `/api/barbecues/:bbqId/participants` | List accepted participants |
| POST | `/api/barbecues/:bbqId/participants` | Add participant (creator only, auto-accepted) |
| GET | `/api/barbecues/:bbqId/pending` | List pending join requests |
| POST | `/api/barbecues/:bbqId/join` | Request to join (creates pending participant) |
| PATCH | `/api/participants/:id/accept` | Accept a join request |
| DELETE | `/api/participants/:id` | Remove/reject participant |
| GET | `/api/memberships?userId=x` | Get all memberships for a user |
| GET | `/api/barbecues/:bbqId/expenses` | List expenses (with participant name) |
| POST | `/api/barbecues/:bbqId/expenses` | Add expense |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |

### Languages
Supported: **English (EN)**, **Spanish (ES)**, **Italian (IT)**, **Dutch (NL)**. Language cycles via a button in the header. Currency labels are translated in all 4 languages.

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
- **Session Store**: `connect-pg-simple` is included for PostgreSQL-backed sessions (though auth is not currently implemented)

### Key npm Packages
- **drizzle-orm** + **drizzle-kit** + **drizzle-zod**: ORM, migration tooling, and schema-to-Zod bridge
- **express** v5: HTTP server framework
- **@tanstack/react-query**: Async server state management
- **recharts**: Charting library for expense visualizations
- **framer-motion**: Animation library
- **wouter**: Lightweight React router
- **zod**: Runtime validation (shared between client and server)
- **shadcn/ui ecosystem**: Radix UI primitives, class-variance-authority, tailwind-merge, clsx, lucide-react icons

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal`: Error overlay in development
- `@replit/vite-plugin-cartographer` and `@replit/vite-plugin-dev-banner`: Dev-only Replit integrations (conditionally loaded)
