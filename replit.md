# replit.md

## Overview

BBQ Expense Tracker is a full-stack web application for tracking barbecue event expenses. Users can create barbecue events, add participants, log expenses by category (Meat, Bread, Drinks, Charcoal, Transportation, Other), and calculate fair cost splits among participants. The app supports multiple currencies (EUR, USD, ARS, GBP, MXN) and bilingual UI (English/Spanish).

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
  - `barbecues` — id, name, date, currency
  - `participants` — id, barbecueId (FK → barbecues, cascade delete), name
  - `expenses` — id, barbecueId (FK → barbecues, cascade delete), participantId (FK → participants, cascade delete), category, item, amount (numeric 10,2)
- **Migrations**: Managed via `drizzle-kit push` (schema push approach, not migration files)

### API Structure
All routes defined in `shared/routes.ts` with Zod schemas for input validation:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/barbecues` | List all BBQ events |
| POST | `/api/barbecues` | Create a BBQ event |
| GET | `/api/barbecues/:id` | Get single BBQ |
| DELETE | `/api/barbecues/:id` | Delete BBQ (cascades) |
| GET | `/api/barbecues/:bbqId/participants` | List participants |
| POST | `/api/barbecues/:bbqId/participants` | Add participant |
| DELETE | `/api/participants/:id` | Remove participant |
| GET | `/api/barbecues/:bbqId/expenses` | List expenses (with participant name) |
| POST | `/api/barbecues/:bbqId/expenses` | Add expense |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |

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