# Football Predictor — Project Context

## Overview
A fullstack football app with match data, standings, and predictions tracking with accuracy stats.

## Stack
- **Frontend:** React + TypeScript + Vite + React Query + Recharts + Ant Design (antd) + @ant-design/icons + Zustand (global auth state) + i18next + react-i18next + i18next-browser-languagedetector
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

### WC Knockout view
WC shows a 3-way `Matches | Table | Knockout` Segmented control (other competitions keep the 2-way toggle). Knockout view:
- Sub-tabs: `Round of 32 | Round of 16 | Quarter Finals | Semi Finals | Final`
- Each sub-tab fetches `GET /matches?competition=WC&stage=<STAGE_KEY>&limit=100` (no pagination)
- stage filter values: `LAST_32`, `LAST_16`, `QUARTER_FINALS`, `SEMI_FINALS`, `FINAL`
- Results are ordered by `matchDate ASC` (upcoming matches first)
- TBD teams (teams not yet determined — stored with placeholder `externalId=0, name="TBD"`) render with a question-mark shield and italic "TBD" / "Не визначено" text
- **Matches view (regular, no stage filter):** any fixture where **either** team is still undetermined is excluded at the **database level** (via `homeTeam: { externalId: { not: 0 } }, awayTeam: { externalId: { not: 0 } }` in the Prisma `where` clause) so the `total` count and pagination are both correct. Only matches with fully-determined teams are shown. Knockout view queries include a `stage` param, which skips this exclusion and returns all matches (including TBD vs TBD and team vs TBD slots).
- **Knockout match detail — Prediction & AI Preview:** when navigating to a match detail page from the Knockout bracket, both the Prediction card and the AI Preview section are hidden if either team is still TBD (`match.homeTeam.externalId === 0 || match.awayTeam.externalId === 0`). They only appear once both teams are fully determined.

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
- Matches sync from football-data.org (auto on request if stale >5 min, or forced); knockout matches with undetermined teams are stored using a TBD placeholder team (`externalId=0`); team FKs are updated on the next sync once real teams are known
- `GET /matches` now accepts `?stage=<STAGE_KEY>` filter; `limit=100` is allowed (for single-stage knockout fetches); stage-filtered results are ordered `ASC` by date
- Redis cache (5-min TTL) on match queries via @nestjs/cache-manager + cache-manager-ioredis-yet; cache key includes page+limit
- Standings cached in Redis (24-hour TTL, keys `standings:<competitionCode>`)
- GET /config — tells frontend whether FOOTBALL_DATA_API_KEY is set
- Role-based access control (USER / ADMIN) — `RolesGuard` + `@Roles()` decorator, role carried in JWT
- "← Back to matches" passes `?comp=<code>&status=<status>&page=<page>` in match links; MatchesPage reads all three params on mount to restore competition tab, status filter, and pagination page on return
- Cron job (`SchedulerService`) auto-resolves predictions every 5 minutes via `@nestjs/schedule`
- Admin panel (`/admin`) — DB stats, Resolve All, Force Sync, users table with expandable per-user prediction detail
- Show/hide password toggle on all password fields via antd `Input.Password` (built-in eye toggle)
- AI Match Statistics — on finished match detail page: "🤖 Get AI Stats" button calls `POST /matches/:id/ai-stats?lang=en|uk`; multilingual — persists `{ en?, uk? }` store in `Match.aiStats`; shows "🌐 Translate to Ukrainian/English" when only the other language is cached; stats data is language-agnostic (numbers + player names) so translation path copies existing data; "🎥 Watch Highlights" link always shown for finished matches (opens Google search in new tab)
- AI Match Preview — on scheduled match detail page: "🔮 Get AI Preview" button calls `POST /matches/:id/ai-preview?lang=en|uk`; multilingual — persists `{ en?, uk? }` store in `Match.aiPreview`; shows "🌐 Translate to Ukrainian/English" when only the other language is cached; Gemini 2.5 Flash + Google Search grounding for fresh fetch, translation-only call (no grounding) when translating from existing data; endpoint returns 400 if match is not SCHEDULED/TIMED

## i18n / Internationalization

- **Libraries:** i18next + react-i18next + i18next-browser-languagedetector
- **Languages:** English (`en`, default) and Ukrainian (`uk`)
- **Config:** `apps/frontend/src/i18n/index.ts` — initializes i18next with inline resources, LanguageDetector (localStorage first, then browser), fallbackLng `en`
- **Locale files:** `apps/frontend/src/i18n/locales/en.json` and `uk.json`
- **Init:** imported in `apps/frontend/src/main.tsx` before App renders (`import './i18n'`)
- **Language persistence:** stored in `localStorage` under key `i18n-lang`
- **Language switcher:** `Segmented` control ("EN" / "UA") in Navbar desktop layout; dropdown items ("EN — English" / "UA — Українська" with checkmark) in mobile avatar dropdown

### Translation key convention

Keys are **flat nested under a namespace** within a single translation file — no separate namespace files.

Pattern: `namespace.camelCaseKey`

Example usage: `const { t } = useTranslation(); t('navbar.signOut')`

Currently translated namespaces:
| Namespace | Coverage |
|-----------|----------|
| `navbar`  | All Navbar labels (brand, nav items, user menu, auth buttons, admin badge) |
| `auth`    | LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage — titles, subtitles, field labels, validation messages, buttons, links, fallback error strings; `checkEmailBody` uses `{{email}}` interpolation |
| `profile` | ProfilePage — title, username/email read-only labels, first/last name form labels and placeholders, save button, success and fallback error messages |
| `admin`   | AdminPage — page title, section headers, stat KPI labels, action card titles/descs/buttons, result messages (`resolveSuccess`/`syncedCount`/`syncSkipped` use `{{}}` interpolation), users table column headers, role/outcome badges, user detail panel labels |
| `matches` | MatchesPage — view/status segment labels, stage filter header, stage names (nested `stages` object), status badge labels (nested `status` object), prediction result badges, standings legend labels, empty/error messages, pagination total (`totalMatches` with `{{count}}`); `emptyStage` uses `{{stage}}`; `stageMatchCount` uses `{{count}}`; API key missing empty message split into 3 keys (`emptyApiKeyPre/Mid/Post`) to preserve `<Text code>` elements |
| `matchDetail` | MatchDetailPage — back link, match-not-found, HT label, prediction card (title, states, outcome badges, form buttons), predicted/actual outcome labels (nested `outcome` object keyed by `HOME_WIN/DRAW/AWAY_WIN`), AI Stats card (title + 4 section labels + shots sub-label + `watchHighlights`), AI Preview card (title + 4 section labels + `translateToEn`/`translateToUk` for translate button); `translateToEn`/`translateToUk` reused for both stats and preview translate buttons; stage label reuses `matches.stages.*`; team/player names from API stay untranslated |
| `predictions` | PredictionsPage — page title (`{{name}}` interpolation), KPI strip labels, pie chart title + slice names, "All predictions" section, empty state (3-part subtitle with link), status/date line reuses `matches.status.*`, outcome label reuses `matchDetail.outcome.*`, exact/correct/wrong badges reuse `matches.predExact/predCorrect/predWrong`, pending label, delete button. Completes i18n rollout across all pages. |

When adding translations for a new page or feature, add a new top-level key block (e.g. `"matches": { ... }`) to both `en.json` and `uk.json`, then call `useTranslation()` in the component.

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
- `POST /matches/:id/ai-stats?lang=en|uk` — requires `JwtAuthGuard`; `lang` defaults to `'en'`
- **DB shape (new):** `Match.aiStats` stores `{ en?: AiMatchStats, uk?: AiMatchStats }` — per-language store
- **Backward compat:** legacy records with a flat `AiMatchStats` shape (top-level `goals` key) are treated as English on read
- **Three-path logic in `AiStatsService.getOrFetchStats(matchId, lang)`:**
  1. `store[lang]` exists → return immediately (cached)
  2. `store[otherLang]` exists → copy directly (no Gemini call — stats are language-agnostic: numbers + player names don't change)
  3. Nothing cached → fresh fetch with Gemini + Google Search grounding
- Response shape per language: `{ goals: { home, away }, cards: { home, away }, possession: { home, away }, shots: { home, away } }`
- Each goal: `{ scorer, minute }`; each card: `{ player, minute, type: "yellow"|"red" }`; possession: percentages; shots: `{ onTarget, total }`
- **Watch Highlights:** always shown for FINISHED matches — opens `https://www.google.com/search?q={homeTeam}+vs+{awayTeam}+highlights+{matchDate}` in new tab
- `AiStatsService` lives in `src/matches/ai-stats.service.ts`; registered in `MatchesModule`; also handles `getOrFetchPreview` for AI Preview

## AI Preview
- `POST /matches/:id/ai-preview?lang=en|uk` — requires `JwtAuthGuard`; returns 400 if match is not SCHEDULED/TIMED; `lang` defaults to `'en'`
- **DB shape (new):** `Match.aiPreview` stores `{ en?: AiMatchPreview, uk?: AiMatchPreview }` — per-language store
- **Backward compat:** legacy records with a flat `AiMatchPreview` shape (top-level `form` key) are treated as English on read
- **Three-path logic in `AiStatsService.getOrFetchPreview(matchId, lang)`:**
  1. `store[lang]` exists → return immediately (cached)
  2. `store[otherLang]` exists → translate with Gemini (no Google Search grounding); merge into store and persist
  3. Nothing cached → fresh fetch with Gemini + Google Search grounding using language instruction; merge and persist
- **Translation path:** pure Gemini call (no grounding); translates `keyPlayers[].note`, `headToHead`, `summary`; preserves form strings, player/team names
- **AiMatchPreview shape:** `{ form: { home, away }, keyPlayers: { home, away }, headToHead, summary }`
- `form`: 5-char string of W/D/L (most recent last); rendered as colored badges on the frontend
- `keyPlayers`: `{ name, note }[]` — 1–2 players per team
- `headToHead`: string or null
- `summary`: 2–3 sentence preview text
- **Frontend:** detects current lang from `i18n.language` → `'uk'` prefix maps to `'uk'`, else `'en'`; `getPreviewForLang()` extracts the right language from the store; shows "🌐 Translate to Ukrainian/English" button when only the other language is cached, "🔮 Get AI Preview" when nothing is cached

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
- **Live queries bypass the cache entirely:** `findAll()` skips both the Redis read and write when the status filter includes `IN_PLAY` or `PAUSED`. Live match statuses change every few minutes; caching them would make the Live tab lag up to 5 minutes behind reality. All other status combinations (Scheduled, Finished, All) are cached normally.
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
