# Objective
Implement four features:
1. Language tab selector (EN/ES/IT/NL tabs instead of cycling button)
2. Currency conversion bar (show total + fair share in all 5 currencies, scrollable)
3. Full user registration + login + profile (bcrypt + express-session, replaces localStorage)
4. Public/private BBQ (visibility control + invite by username for private BBQs)

# Tasks

### T001: Install bcryptjs
- **Blocked By**: []
- **Details**: Install bcryptjs + @types/bcryptjs for password hashing

### T002: Schema update
- **Blocked By**: [T001]
- **Details**:
  - Add `users` table: id (serial PK), username (text unique notNull), passwordHash (text notNull), createdAt (timestamp)
  - Add `isPublic` boolean (default true) to `barbecues`
  - Add "invited" as valid status in participants (already text, no change needed)
  - Run db:push after

### T003: Session middleware
- **Blocked By**: []
- **Details**:
  - Update server/index.ts to add express-session + connect-pg-simple store
  - Use SESSION_SECRET env var
  - Augment express-session types to include userId + username on session

### T004: Storage interface (users + privacy)
- **Blocked By**: [T002]
- **Details**:
  - Add createUser, getUserByUsername, getUserById methods
  - Update getBarbecues(userId?) to filter private ones
  - Add inviteParticipant(bbqId, name, userId) method

### T005: Backend auth routes + invite routes
- **Blocked By**: [T003, T004]
- **Details**:
  - POST /api/auth/register: { username, password }
  - POST /api/auth/login: { username, password }
  - POST /api/auth/logout
  - GET /api/auth/me
  - POST /api/barbecues/:bbqId/invite { username }
  - Update GET /api/barbecues to filter by session user for private BBQs

### T006: Frontend auth hook + UI
- **Blocked By**: [T005]
- **Details**:
  - New useAuth hook: GET /api/auth/me on mount, provides { user, login, register, logout, isLoading }
  - Remove use-user.tsx localStorage dependency
  - Login/Register dialog (replaces username setup dialog)
  - Profile dropdown in header (shows username, logout button)
  - Invite panel in home.tsx for private BBQs (creator types username to invite)

### T007: Language tabs + Currency bar
- **Blocked By**: []
- **Details**:
  - Replace cycling language button with 4 tab buttons side by side
  - Add horizontal scrollable currency bar below stats showing total + fair share in all 5 currencies
  - Add isPublic toggle to "Create BBQ" dialog
  - Private BBQ cards show lock icon

