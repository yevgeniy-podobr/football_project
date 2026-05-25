# Football Predictor

A fullstack web app for predicting football match outcomes across five top competitions. Pick scores before kick-off, track your accuracy, and see how you stack up with detailed stats and charts.

## Features

- Browse matches across Champions League, Premier League, La Liga, Bundesliga, and Serie A
- Separate tab per competition, each with Scheduled / Live / Finished filters
- Grouped view for Finished CL matches (by stage, then season)
- Submit and update score predictions before a match starts
- Automatic outcome resolution once results are in
- Competition badge (UCL / PL / LaLiga / BL / SA) on every match card and detail page
- Personal stats dashboard: accuracy, correct/exact scores, outcome breakdown
- Recharts visualisations: pie chart, bar chart, prediction trend
- Auto-sync with live data from football-data.org (5-minute cache)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | NestJS 10, TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Frontend | React 18, Vite, TypeScript |
| Styling | Tailwind CSS |
| Data fetching | TanStack Query v5, Axios |
| Charts | Recharts |
| Package manager | pnpm workspaces |
| External API | football-data.org v4 (free tier) |

---

## Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **pnpm** — `npm install -g pnpm`
- **PostgreSQL** — running locally on port 5432

---

## Getting Started

### 1. Clone the repo

```bash
git clone <repo-url>
cd football-project
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Create the backend `.env` file

```bash
cp apps/backend/.env.example apps/backend/.env
```

Then open `apps/backend/.env` and fill in your values:

```env
DATABASE_URL=postgresql://<user>@localhost:5432/football_db
FOOTBALL_DATA_API_KEY=your_key_here
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

### 4. Create the PostgreSQL database

```bash
psql -U <your-pg-user> -c "CREATE DATABASE football_db;"
```

### 5. Push the schema to the database

```bash
pnpm db:push
```

This syncs the Prisma schema to your database without running migrations. Safe to re-run at any time — it is non-destructive unless you explicitly use `--force-reset`.

### 6. Start the app

```bash
pnpm dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api

On first load, the app will automatically fetch and cache matches from all five competitions (requires `FOOTBALL_DATA_API_KEY` to be set).

---

## Available Scripts

All scripts run from the **project root**.

| Script | Description |
|---|---|
| `pnpm dev` | Start backend and frontend in parallel (hot reload) |
| `pnpm dev:backend` | Start the NestJS backend only |
| `pnpm dev:frontend` | Start the Vite frontend only |
| `pnpm build` | Production build for both apps |
| `pnpm db:push` | Sync Prisma schema to the database |
| `pnpm db:migrate` | Run Prisma migrations (alternative to db:push) |
| `pnpm db:generate` | Regenerate Prisma Client after schema changes |
| `pnpm db:studio` | Open Prisma Studio (visual database browser) |

---

## Environment Variables

All variables live in `apps/backend/.env`.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `FOOTBALL_DATA_API_KEY` | No* | API key for football-data.org |
| `PORT` | No | Port for the NestJS server (default: `3000`) |
| `CORS_ORIGIN` | No | Allowed CORS origin (default: `http://localhost:5173`) |

\* The app runs without an API key — matches page will show an empty state with instructions to add one.

### `DATABASE_URL` format

```
postgresql://<user>:<password>@<host>:<port>/<database>
```

Examples:
```
postgresql://postgres:secret@localhost:5432/football_db
postgresql://alice@localhost:5432/football_db
```

---

## API Key Setup (football-data.org)

The app uses the **free tier** of [football-data.org](https://www.football-data.org) to fetch match data for all five competitions.

### Supported competitions (free tier)

| Code | Competition | Badge |
|---|---|---|
| CL | UEFA Champions League | UCL |
| PL | Premier League | PL |
| PD | La Liga | LaLiga |
| BL1 | Bundesliga | BL |
| SA | Serie A | SA |

### What the free tier provides

- Match schedule, status, and scores
- Half-time scores and match winner
- Team names, short names, and crest images
- Tournament stage and season

### What the free tier does NOT include

- Goal scorers and minutes
- Lineups and squad data
- Match statistics (possession, shots, corners, fouls)

### How to get an API key

1. Go to [football-data.org](https://www.football-data.org) and create a free account
2. Your API key will appear in your account dashboard
3. Add it to `apps/backend/.env`:

```env
FOOTBALL_DATA_API_KEY=your_key_here
```

4. Restart the backend — the app will sync match data automatically on the next request, or you can force an immediate sync:

```
GET http://localhost:3000/api/matches/sync?force=true
```

### Rate limits (free tier)

- 10 requests per minute
- The app caches all data for 5 minutes, so normal usage stays well within limits

---

## Project Structure

```
football-project/
├── apps/
│   ├── backend/          # NestJS API
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/
│   │       ├── matches/
│   │       ├── predictions/
│   │       ├── stats/
│   │       └── users/
│   └── frontend/         # React + Vite
│       └── src/
│           ├── api/
│           ├── components/
│           ├── context/
│           ├── pages/
│           └── types/
├── package.json          # Root workspace config
└── pnpm-workspace.yaml
```

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/matches` | All matches (optional `?status=FINISHED&competition=PL`) |
| `GET` | `/api/matches/:id` | Single match with predictions |
| `GET` | `/api/matches/sync` | Trigger data sync (`?force=true` to bypass cache) |
| `GET` | `/api/matches/upcoming` | Next 5 scheduled matches |
| `GET` | `/api/matches/recent` | Last 10 finished matches |
| `GET` | `/api/matches/h2h` | Head-to-head (`?homeId=1&awayId=2`) |
| `POST` | `/api/users` | Create or return existing user by email |
| `POST` | `/api/predictions` | Submit a prediction |
| `PATCH` | `/api/predictions/:id` | Update a prediction |
| `DELETE` | `/api/predictions/:id` | Delete a prediction |
| `POST` | `/api/predictions/resolve-all` | Resolve outcomes for all finished matches |
| `GET` | `/api/stats` | Global stats across all users |
| `GET` | `/api/stats/:userId` | Stats for a single user |
| `POST` | `/api/stats/recalculate/:userId` | Recalculate stats for a user |
| `GET` | `/api/config` | Returns `{ footballApiConfigured: boolean }` |
