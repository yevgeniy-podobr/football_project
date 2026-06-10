# Football Predictor — Project Context

## Overview
A fullstack football app with match data, standings, and predictions tracking with accuracy stats.

## Stack
- **Frontend:** React + TypeScript + Vite + React Query + Recharts + Ant Design (antd) + @ant-design/icons
- **Backend:** NestJS + TypeScript
- **Database:** PostgreSQL + Prisma
- **Monorepo:** pnpm workspaces
- **Linter/Formatter:** Biome (`biome.json` at root — 2-space indent, single quotes, trailing commas, import sorting)
- **External API:** football-data.org (free tier, 10 req/min)

## Ports
- Frontend: http://localhost:5173
- Backend: http://localhost:3000/api

## Project Structure
```
football_project/
├── apps/
│   ├── backend/   # NestJS
│   └── frontend/  # React + Vite
├── CLAUDE.md
└── pnpm-workspace.yaml
```

## Competitions (football-data.org free tier)
| Name | Code | Badge | Tab color |
|------|------|-------|-----------|
| FIFA World Cup 2026 | WC | WC | green |
| UEFA Champions League | CL | UCL | blue |
| Premier League (England) | PL | PL | purple |
| La Liga (Spain) | PD | LaLiga | orange |
| Bundesliga (Germany) | BL1 | BL | red |
| Serie A (Italy) | SA | SA | cyan |

### Competition display flags (`hasStages`)
Each competition carries a `hasStages` flag in the frontend `COMPETITIONS` array that controls rendering:
- `hasStages: true` — **CL only**: finished matches grouped by stage, stage filter chips shown, no Matches/Table toggle
- `hasStages: false` — **WC + all leagues**: flat match list, Matches/Table toggle available, stage filter chips hidden

## Features Implemented
- Multi-competition tabs (WC, CL, PL, PD, BL1, SA) with color-coded badges; WC is the first tab
- Matches list with All / Scheduled / Live / Finished tabs
- CL matches grouped by stage on the Finished tab (Final, Semi Finals, Quarter Finals, etc.)
- Stage filter chips on CL Finished tab only
- Match detail page with goals (scorer, minute, OG/penalty tags), halftime score
- Standings / league tables for PL, PD, BL1, SA (with CL spots + relegation zone row highlighting)
- WC standings: all 12 groups (A–L) rendered in a responsive grid; top 2 per group highlighted green (advance to Round of 32); no relegation zone
- JWT Authentication — fully implemented on backend and frontend
- Password reset via email (Mailtrap SMTP, 15-minute token expiry)
- Predictions: create, update, delete (blocked on finished matches)
- Predictions accuracy tracking: resolved vs pending, exact score detection
- Predictions page with KPI strip + pie/bar/line charts (Recharts)
- Global stats endpoint (aggregate across all users)
- Per-user stats with recalculate endpoint
- POST /predictions/resolve-all — scores all unresolved predictions for finished matches
- Matches sync from football-data.org (auto on request if stale >5 min, or forced)
- GET /matches/upcoming, /matches/recent, /matches/h2h endpoints
- In-memory cache (5-min TTL) on match queries via @nestjs/cache-manager
- Standings cached in DB (24-hour TTL via StandingsCache table)
- GET /config — tells frontend whether FOOTBALL_DATA_API_KEY is set
- Role-based access control (USER / ADMIN) — `RolesGuard` + `@Roles()` decorator, role carried in JWT
- "← Back to matches" passes `?comp=<code>` in match links, restoring the correct competition tab on return
- Cron job (`SchedulerService`) auto-resolves predictions every 5 minutes via `@nestjs/schedule`
- Admin panel (`/admin`) — DB stats, Resolve All, Force Sync, users table with expandable per-user prediction detail
- Show/hide password toggle on all password fields via antd `Input.Password` (built-in eye toggle)

## Auth
All endpoints and frontend pages are fully implemented and wired up.

### Backend endpoints
- `POST /auth/register` — username + email + password → returns JWT + user
- `POST /auth/login` — email + password → returns JWT + user
- `GET /auth/me` — returns current user (JwtAuthGuard)
- `POST /auth/forgot-password` — sends reset email via SMTP
- `POST /auth/reset-password` — validates token (15-min expiry), updates password

### Frontend pages
- `/login` — LoginPage
- `/register` — RegisterPage
- `/forgot-password` — ForgotPasswordPage
- `/reset-password?token=...` — ResetPasswordPage
- `/admin` — AdminPage (ADMIN role required; redirects to `/` otherwise)

### Implementation details
- Passwords hashed with bcryptjs (10 rounds)
- JWT signed with HS256, expires in 7 days; payload includes `sub`, `email`, `username`, `role`
- Token stored in `localStorage` under key `cl-predictor-token`; user object stored under `cl-predictor-user`
- `GET /auth/me` returns the decoded JWT payload (`sub`, `email`, `username`, `role`) — not a live DB lookup; role or username changes require re-login to take effect
- 401 interceptor in axios client auto-redirects to `/login` (except on `/auth/*` endpoints)
- `/predictions` route is protected by `ProtectedRoute` component
- `POST /auth/forgot-password` always returns 200 with the same message regardless of whether the email exists; returns after a 250 ms delay when not found to prevent timing-based enumeration

## Prisma Models

### User
- id, username (unique, optional), email (unique), name (optional)
- role (Role enum, default USER)
- passwordHash (optional), resetToken (optional), resetTokenExpiry (optional)
- predictions[], stats (PredictionStats), createdAt

### Team
- id, externalId (unique), name, shortName, crest
- homeMatches[], awayMatches[]

### Match
- id, externalId (unique), homeTeamId, awayTeamId
- matchDate, status, stage, group
- homeScore, awayScore, halfTimeHome, halfTimeAway, winner
- goals (Json array), competition, competitionCode, season, cachedAt
- predictions[]

### Prediction
- id, userId, matchId
- predictedHome, predictedAway
- outcome (Outcome enum | null), isExactScore (bool | null)
- createdAt, updatedAt
- unique constraint: (userId, matchId)

### Role enum
`USER | ADMIN`

### Outcome enum
`HOME_WIN | DRAW | AWAY_WIN`

### StandingsCache
- id, competitionCode (unique), data (Json), cachedAt
- `data` shape for leagues: `StandingRow[]` (flat array)
- `data` shape for WC: `GroupStandingRow[]` — `{ group: string; table: StandingRow[] }[]`, sorted A–L
- Cache bust: WC entry is invalidated if `data[0]` lacks `group`+`table` keys (detects stale flat-format rows)

### PredictionStats
- id, userId (unique)
- total, correct, exactScores
- homeWinCorrect, drawCorrect, awayWinCorrect
- accuracy (float), updatedAt

## Auth — Roles
- `Role` enum on User: `USER` (default) | `ADMIN`
- `role` is included in the JWT payload
- `RolesGuard` + `@Roles()` decorator live in `src/auth/`
- `POST /predictions/resolve-all` requires `ADMIN` role (returns 403 for regular users)
- `GET /admin/stats` requires `ADMIN` role — returns `{ users, predictions, matches, lastSyncAt }`
- `GET /admin/users` requires `ADMIN` role — list with predictionCount + accuracy from PredictionStats
- `GET /admin/users/:id` requires `ADMIN` role — full detail with stats + predictions (ordered by matchDate desc)
- To promote a user to admin: `UPDATE "User" SET role = 'ADMIN' WHERE email = '...'`

## Known Issues
- `POST /users` and `GET /users` are legacy endpoints with no auth guard

## Data Limitations (free tier)
- No lineups / squad data
- No match statistics (possession, shots, fouls)
- Goals with scorer name and minute ✅
- Standings ✅
- Max 10 requests/minute — standings cached 24h, matches cached 5 min

## Scripts
```bash
pnpm dev          # run both frontend and backend
pnpm dev:backend  # backend only (port 3000)
pnpm dev:frontend # frontend only (port 5173)
pnpm db:push      # apply Prisma schema changes
pnpm db:migrate   # run Prisma migrations
pnpm db:studio    # open Prisma Studio
pnpm lint         # biome lint ./apps
pnpm format       # biome format --write ./apps
pnpm check        # biome check --write ./apps (lint + format + import sort)
```

## Environment Variables (apps/backend/.env)
```
DATABASE_URL=postgresql://YOUR_USER@localhost:5432/football_db
FOOTBALL_DATA_API_KEY=your_key_here
JWT_SECRET=your_jwt_secret
PORT=3000                        # optional, defaults to 3000
CORS_ORIGIN=http://localhost:5173 # also used as base URL for password reset links
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USER=your_mailtrap_user
SMTP_PASS=your_mailtrap_pass
```

## Node / Package Manager
- Node.js v20 via nvm (`nvm use 20`)
- pnpm (`npm install -g pnpm`)
- If pnpm not found after restart: `source ~/.zshrc && nvm use 20`
