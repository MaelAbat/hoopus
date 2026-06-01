# Hoopus

A French-language NBA companion app: live scores, schedule, standings, stat leaders, player career stats, playoffs, news, articles, and mini-games.

Live at [hoopus.fr](https://hoopus.fr).

## Stack

- **Framework** — Next.js 16 (App Router, React 19, TypeScript)
- **Styling** — Tailwind CSS 4
- **Database & Auth** — Supabase (Postgres with Row Level Security)
- **Hosting** — Vercel (cron jobs included)
- **Data sources** — NBA Stats API, ESPN, YouTube Data API v3

## Features

- Live scores and game ticker
- Full schedule with date navigation
- Conference standings and play-in/playoff bracket
- Statistical leaders (points, rebounds, assists, blocks, steals, three-point %)
- Player career stats with advanced metrics
- Team rosters with salary data
- Injury reports
- News feed and long-form articles with Markdown rendering
- User accounts, favorites system, light/dark theming
- Quizzes and mini-games
- Picture-in-picture video player for game highlights

## Local development

Prerequisites: Node.js 20+, a Supabase project, a YouTube Data API v3 key.

```bash
git clone https://github.com/MaelAbat/hoopus.git
cd hoopus
npm install
cp .env.example .env.local
# fill in the values in .env.local
npm run dev
```

The dev server runs on [http://localhost:3002](http://localhost:3002).

### Environment variables

See [.env.example](./.env.example) for the full list. You will need:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client-side Supabase access (safe to expose, protected by RLS)
- `SUPABASE_SERVICE_ROLE_KEY` — server-side admin access (keep secret)
- `CRON_SECRET` — shared secret for authenticating cron job calls
- `YOUTUBE_API_KEY` — for fetching match highlight videos
- `NEXT_PUBLIC_SITE_URL` — used for auth redirects

### Database schema

Migrations live in [`supabase/migrations/`](./supabase/migrations) and run in numerical order. Apply them through the Supabase dashboard or the Supabase CLI.

## Data sync

Game data, standings, stats, and rosters are refreshed via a daily Vercel cron at 08:00 UTC (`vercel.json`). Individual sync endpoints exist under `/api/sync-*` and require the `CRON_SECRET` in the `Authorization` header.

To run a sync manually from the command line:

```bash
npm run sync          # full sync
npm run sync:history  # backfill historical games
```

## Project structure

```
src/app/        Next.js App Router pages and API routes
src/components/ Reusable React components
src/lib/        Supabase clients, data fetchers, utilities
scripts/        CLI sync scripts (tsx)
supabase/       SQL migrations
public/         Static assets
```

## Deployment

Pushes to `main` are auto-deployed by Vercel. Environment variables are managed in the Vercel dashboard. No CI runs in this repository (`.gitlab-ci.yml` disables GitLab pipelines).

## License

ISC.
