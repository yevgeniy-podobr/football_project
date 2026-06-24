# Football Predictor — Project Context

## Overview
A fullstack football app with match data, standings, and predictions tracking with accuracy stats.

## Stack
- **Frontend:** React + TypeScript + Vite + React Query + Recharts + Ant Design (antd) + @ant-design/icons + Zustand (global auth state)
- **Backend:** NestJS + TypeScript
- **Database:** PostgreSQL + Prisma
- **Cache:** Redis (ioredis + cache-manager-ioredis-yet via @nestjs/cache-manager)
- **Monorepo:** pnpm workspaces
- **Linter/Formatter:** Biome (`biome.json` at root — 2-space indent, single quotes, trailing commas, import sorting)
- **External API:** football-data.org (free tier, 10 req/min)
- **AI:** Google Gemini 2.5 Flash (`@google/genai`) with Google Search grounding

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
- Matches list with All / Scheduled / Live / Finished tabs; server-side pagination (10/20/30 per page, Ant Design Pagination below the list)
- CL matches grouped by stage on the Finished tab (Final, Semi Finals, Quarter Finals, etc.)
- Stage filter chips on CL Finished tab only
- Match detail page with halftime score
- Standings / league tables for PL, PD, BL1, SA (with CL spots + relegation zone row highlighting)
- WC standings: all 12 groups (A–L) rendered in a responsive grid; top 2 per group highlighted green (advance to Round of 32); no relegation zone
- JWT Authentication — fully implemented on backend and frontend
- Password reset via email (Mailtrap SMTP, 15-minute token expiry)
- Predictions: create, update, delete (blocked on finished matches)
- Predictions accuracy tracking: resolved vs pending, exact score detection
- Predictions page with KPI strip + pie/bar/line charts (Recharts)
- POST /predictions/resolve-all — scores all unresolved predictions for finished matches
- Matches sync from football-data.org (auto on request if stale >5 min, or forced)
- Redis cache (5-min TTL) on match queries via @nestjs/cache-manager + cache-manager-ioredis-yet; cache key includes page+limit
- Standings cached in Redis (24-hour TTL, keys `standings:<competitionCode>`)
- GET /config — tells frontend whether FOOTBALL_DATA_API_KEY is set
- Role-based access control (USER / ADMIN) — `RolesGuard` + `@Roles()` decorator, role carried in JWT
- "← Back to matches" passes `?comp=<code>&status=<status>&page=<page>` in match links; MatchesPage reads all three params on mount to restore competition tab, status filter, and pagination page on return
- Cron job (`SchedulerService`) auto-resolves predictions every 5 minutes via `@nestjs/schedule`
- Admin panel (`/admin`) — DB stats, Resolve All, Force Sync, users table with expandable per-user prediction detail
- Show/hide password toggle on all password fields via antd `Input.Password` (built-in eye toggle)
- AI Match Statistics — on finished match detail page: "🤖 Get AI Stats" button calls `POST /matches/:id/ai-stats`; Gemini 2.5 Flash + Google Search grounding returns goals, cards, possession, shots; result persisted in `Match.aiStats` (fetched once, served from DB on subsequent loads)
- AI Match Preview — on scheduled match detail page: "🔮 Get AI Preview" button calls `POST /matches/:id/ai-preview`; Gemini 2.5 Flash + Google Search grounding returns recent form (W/D/L badges), key players, H2H note, summary; persisted in `Match.aiPreview`; endpoint returns 400 if match is not SCHEDULED/TIMED

## Auth
All endpoints and frontend pages are fully implemented and wired up.

### Backend endpoints
- `POST /auth/register` — username + email + password + optional firstName/lastName → returns JWT + user
- `POST /auth/login` — email + password → returns JWT + user
- `GET /auth/me` — returns current user from JWT payload (JwtAuthGuard)
- `PATCH /auth/profile` — update firstName/lastName for logged-in user (JwtAuthGuard); returns new JWT + updated user
- `POST /auth/forgot-password` — sends reset email via SMTP
- `POST /auth/reset-password` — validates token (15-min expiry), updates password

### Frontend pages
- `/login` — LoginPage
- `/register` — RegisterPage (optional firstName/lastName fields)
- `/profile` — ProfilePage (edit firstName/lastName; username/email shown read-only; protected)
- `/forgot-password` — ForgotPasswordPage
- `/reset-password?token=...` — ResetPasswordPage
- `/admin` — AdminPage (ADMIN role required; redirects to `/` otherwise)

### Implementation details
- Passwords hashed with bcryptjs (10 rounds)
- JWT signed with HS256, expires in 7 days; payload includes `sub`, `email`, `username`, `role`, `firstName`, `lastName`
- Token stored in `localStorage` under key `cl-predictor-token`; user object stored under `cl-predictor-user`
- `GET /auth/me` returns the decoded JWT payload — not a live DB lookup; role or username changes require re-login to take effect
- `PATCH /auth/profile` re-signs the JWT with updated firstName/lastName and returns `{ access_token, user }`; frontend calls `updateUser()` from the Zustand `useUserStore` to refresh state and localStorage
- Navbar shows `firstName lastName` when set, falls back to username then email
- 401 interceptor in axios client auto-redirects to `/login` (except on `/auth/*` endpoints)
- `/predictions` route is protected by `ProtectedRoute` component
- `POST /auth/forgot-password` always returns 200 with the same message regardless of whether the email exists; returns after a 250 ms delay when not found to prevent timing-based enumeration

## AI Stats
- `POST /matches/:id/ai-stats` — requires `JwtAuthGuard`; returns cached `Match.aiStats` immediately if already populated; otherwise calls Gemini 2.5 Flash with Google Search grounding, parses the JSON response, persists to `Match.aiStats`, and returns the result
- Response shape: `{ goals: { home, away }, cards: { home, away }, possession: { home, away }, shots: { home, away } }`
- Each goal: `{ scorer, minute }`; each card: `{ player, minute, type: "yellow"|"red" }`; possession: percentages; shots: `{ onTarget, total }`
- `AiStatsService` lives in `src/matches/ai-stats.service.ts`; registered in `MatchesModule`; also handles `getOrFetchPreview` for AI Preview

## AI Preview
- `POST /matches/:id/ai-preview` — requires `JwtAuthGuard`; returns 400 if match is not SCHEDULED/TIMED; returns cached `Match.aiPreview` if already populated; otherwise calls Gemini 2.5 Flash with Google Search grounding
- Response shape: `{ form: { home, away }, keyPlayers: { home, away }, headToHead, summary }`
- `form`: 5-char string of W/D/L (most recent last); rendered as colored badges on the frontend
- `keyPlayers`: `{ name, note }[]` — 1–2 players per team
- `headToHead`: string or null
- `summary`: 2–3 sentence preview text

## Prisma Models

### User
- id, username (unique, optional), email (unique), name (optional), firstName (optional), lastName (optional)
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
- aiStats (Json, nullable) — populated on demand via Gemini AI for finished matches
- aiPreview (Json, nullable) — populated on demand via Gemini AI for scheduled matches
- competition, competitionCode, season, cachedAt
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

### PredictionStats
- id, userId (unique)
- total, correct, exactScores
- homeWinCorrect, drawCorrect, awayWinCorrect
- accuracy (float), updatedAt

## Redis Cache
- Wired in `AppModule` via `CacheModule.registerAsync` + `redisInsStore(new Redis(REDIS_URL))`; global, default TTL 5 min (match queries)
- Standings stored under `standings:<competitionCode>` with 24h TTL (`StandingsService` uses injected `CACHE_MANAGER`, no DB table — the Prisma `StandingsCache` model was removed)
- Standings value shape for leagues: `StandingRow[]` (flat array)
- Standings value shape for WC: `GroupStandingRow[]` — `{ group: string; table: StandingRow[] }[]`, sorted A–L
- Cache bust: WC entry is invalidated if `data[0]` lacks `group`+`table` keys (detects stale flat-format rows)
- Force sync deletes only `matches:*` keys — never call `cache.reset()`: it flushes the whole Redis DB, which is shared with other local apps (Bull queues etc.) and would also wipe `standings:*`
- Redis must be running locally (`redis://localhost:6379` by default, e.g. `brew services start redis`)

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
- Gemini API occasionally returns 503 (high demand / overloaded); `AiStatsService` does not retry — if this becomes frequent, add exponential-backoff retry around the `ai.models.generateContent` call

## Data Limitations (free tier)
- No lineups / squad data
- No match statistics from football-data.org (possession, shots, fouls not in API response) — superseded by AI stats feature for finished matches
- No goals data — `goals` field not returned by free tier on any endpoint; `goals` column dropped from DB; goal scorers now sourced via AI stats
- Standings ✅
- Max 10 requests/minute — standings cached 24h, matches cached 5 min

## Scripts
```bash
pnpm dev              # run both frontend and backend
pnpm dev:backend      # backend only (port 3000)
pnpm dev:frontend     # frontend only (port 5173)
pnpm db:push          # apply Prisma schema changes
pnpm db:migrate       # run Prisma migrations
pnpm db:studio        # open Prisma Studio
pnpm lint             # biome lint ./apps
pnpm format           # biome format --write ./apps
pnpm check            # biome check --write ./apps (lint + format + import sort)
pnpm build            # build backend (nest build) then frontend (tsc + vite build)
pnpm test:frontend    # run frontend unit/integration tests once (vitest run)
pnpm test:backend     # run backend unit tests once (jest)
```

## Frontend Testing
- **Framework:** Vitest 2.x + React Testing Library + jsdom
- **Compatible with Vite 5** — vitest@2 is required (vitest@4 requires Vite 6+)
- **Config:** `test` block in `apps/frontend/vite.config.ts` (`/// <reference types="vitest" />` at top)
- **Setup file:** `apps/frontend/src/test/setup.ts` — imports `@testing-library/jest-dom`, mocks `window.matchMedia` and `ResizeObserver` (required by Ant Design in jsdom)
- **Globals:** `true` — vitest injects `describe`/`it`/`expect`/`vi` globally; test files use explicit imports for biome compatibility
- **tsconfig types:** `["vite/client", "vitest/globals"]`
- **Utility functions** shared by tests live in `apps/frontend/src/utils/matchUtils.ts` (`stageLabel`, `seasonLabel`, `STAGE_ORDER`)
- **Test files** live in `apps/frontend/src/test/`

### Ant Design notes in tests
- `Form.useWatch` triggers internal state updates that React's test renderer doesn't track — produces cosmetic `act(...)` warnings but tests pass correctly; use `waitFor` for assertions that depend on form state settling
- Zustand stores can be seeded directly with `useStore.setState({ ... })` — no Provider needed

## Backend Testing
- **Framework:** Jest 29 + ts-jest 29 + @nestjs/testing 10
- **Jest version locked to 29** — ts-jest has no v30 release yet; install `jest@29` / `@types/jest@29` (not latest)
- **Config:** `"jest"` block in `apps/backend/package.json`; `rootDir: "src"`, `testRegex: "*.spec.ts"`, `testEnvironment: "node"`
- **ts-jest config:** inline `tsconfig` override `{ "types": ["jest", "node"] }` so Jest globals are typed without touching `tsconfig.json`
- **Test files** colocated with source: `src/**/*.spec.ts`
- **Mocking strategy:** inject mocks via `Test.createTestingModule` providers; mock Prisma as a plain object matching the methods called; use `jest.mock('bcryptjs')` for bcrypt to intercept `hash`/`compare` before the service calls them
- **`$transaction` mock:** implement as `jest.fn().mockImplementation((fn) => fn(mockTx))` where `mockTx` carries the required model methods

## CI
GitHub Actions workflow at `.github/workflows/ci.yml` runs on every push/PR to `main`:
1. Install deps (`pnpm install --frozen-lockfile`)
2. Generate Prisma client (`pnpm db:generate`)
3. Lint (`pnpm lint` — Biome)
4. Test frontend (`pnpm test:frontend` — Vitest)
5. Test backend (`pnpm test:backend` — Jest)
6. Build (`pnpm build` — NestJS + Vite)

No deployment steps — CI only.

## Deployment (Render)

Configuration lives in `render.yaml` at repo root (Render Blueprint). Connect the repo in the Render dashboard and it auto-provisions both services.

### Backend — Web Service (`football-predictor-api`)
- **Build:** `pnpm install --frozen-lockfile && pnpm db:generate && pnpm --filter backend build && pnpm db:push`
  - `pnpm db:push` runs on every deploy — keeps the DB schema in sync with `schema.prisma`. Safe for additive changes; for destructive changes use `prisma migrate deploy` instead.
  - `DATABASE_URL` must be set as a **build-time** env var (Render makes all `envVars` from `render.yaml` available at build time automatically).
- **Start:** `pnpm --filter backend start:prod` → `node dist/main`
- `PORT` is set automatically by Render — `main.ts` reads `process.env.PORT`.
- `CORS_ORIGIN` must be set to the deployed frontend URL (e.g. `https://football-predictor.onrender.com`).

### Frontend — Static Site (`football-predictor-frontend`)
- **Build:** `pnpm install --frozen-lockfile && pnpm --filter frontend build`
- **Publish dir:** `apps/frontend/dist`
- SPA fallback rewrite `/* → /index.html` is configured in `render.yaml`.
- `VITE_API_URL` must be set to the backend URL **including the `/api` suffix** (e.g. `https://football-predictor-api.onrender.com/api`). Vite bakes this into the bundle at build time. Without it the frontend falls back to the relative `/api` path, which only works when both services share a domain.

### Required env vars on Render (backend service)
| Variable | Notes |
|---|---|
| `DATABASE_URL` | Auto-wired by Blueprint via `fromDatabase` — do not set manually |
| `REDIS_URL` | External Redis — use Upstash (free tier); Render free tier has no Redis add-on |
| `FOOTBALL_DATA_API_KEY` | football-data.org API key |
| `GEMINI_API_KEY` | Google AI Studio key |
| `JWT_SECRET` | Random secret, at least 32 chars |
| `CORS_ORIGIN` | Deployed frontend URL, no trailing slash |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Mailtrap (or production SMTP) |
| `PORT` | Set automatically by Render — do not set manually |

### Required env vars on Render (frontend static site)
| Variable | Notes |
|---|---|
| `VITE_API_URL` | Full backend API base URL, e.g. `https://football-predictor-api.onrender.com/api` |

### First-time setup order
1. Connect the repo in Render and apply the Blueprint — Render auto-provisions the PostgreSQL database (`football-predictor-db`) and wires `DATABASE_URL` automatically via `fromDatabase`
2. Create an Upstash Redis instance → copy the `rediss://` URL to `REDIS_URL` on the backend service
3. `pnpm db:push` runs automatically in the backend build and creates all tables
4. Set `VITE_API_URL` on the frontend static site pointing at the live backend URL
5. Set `CORS_ORIGIN` on the backend to the live frontend URL and redeploy

### Free-tier caveats
- Render free Web Services spin down after 15 min of inactivity — first request after idle takes ~30 s
- Upstash Redis free tier: 10k commands/day; cached responses count against this

## Environment Variables (apps/backend/.env)
```
DATABASE_URL=postgresql://YOUR_USER@localhost:5432/football_db
REDIS_URL=redis://localhost:6379
FOOTBALL_DATA_API_KEY=your_key_here
GEMINI_API_KEY=your_gemini_api_key   # Google AI Studio key for AI match stats
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
