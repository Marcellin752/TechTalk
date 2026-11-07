# TechTalk

TechTalk is an educational scrolling application for tech professionals and students. It aggregates articles, videos, and news from top-tier platforms — Dev.to, YouTube, and global RSS feeds — into a single personalized feed, turning passive scrolling into productive tech watch sessions.

## Features

- **Personalized feed** — articles and videos aggregated hourly by background workers (`node-cron`), with search, type, and category filters
- **Authentication** — email/password registration or Google Sign-In, with automatic session refresh
- **Bookmarks & reading history** — per-user saved content and read tracking, synced across devices
- **For you ranking, wildcards and sources** — videos, repositories, articles and opportunities, ranked by interests and GitHub activity, with an off-topic pick every 20–30 items
- **Learn & Practice** — courses, roadmaps, docs, papers and exercises, plus a personalised learning path built from an onboarding wizard
- **Kairos** — an AI mentor (Groq, Gemini as fallback) grounded in the catalogue, with history and a floating button
- **Public profiles** — opt-in profile with projects, interests and (only if the learner allows it) the roadmap; People directory
- **Calendar** — month view, your own events (study, school, deadline), a planner that spreads the rest of your path over the weeks you choose, and an `.ics` export for Google/Outlook/Apple Calendar
- **School-aware path** — say where you study and what you are covering; the path gets a dedicated stage and ranks matching resources first
- **Campus** (partner schools) — revision sessions students organise, a library of past exams, an opt-in directory to meet students of the same school
- **Schools** — a school gets an API key to keep its curriculum current, push exams and deadlines into students' calendars, add official past exams and read anonymous group statistics; learners choose what they share. See [`docs/SCHOOLS_API.md`](docs/SCHOOLS_API.md)
- **Several paths** — a school path (a year of the school's programme, one stage per project), a personal one and others of your choosing, with one marked as the main path
- **Roadmap map** — the learning path as a tree of nodes with curved links and yes / not-yet checkpoints, scrolling sideways in its own section
- **Design for people and AI** — [`docs/DESIGN.md`](docs/DESIGN.md), a live `/design` page, `/design-tokens.json`, screenshots in `docs/screens/`, `/llms.txt`
- **Sessions** — short-lived access tokens (15 min) plus rotating refresh tokens (30 days) with reuse detection; signing out retires the token on the server
- **Admin area** (`/admin`, administrators only) — statistics, users (promote, sign out everywhere, delete), comment and content moderation, manual content refresh, audit log
- **EN / FR**, SEO tags, `robots.txt` and a sitemap
- **Responsive UI** — mobile-first React client with infinite scroll and pull-to-refresh

## Project Structure

```text
TechTalk/
├── apps/
│   ├── backend/     # Fastify + TypeScript REST API, Drizzle ORM, aggregation workers
│   └── frontend/    # React + TypeScript + Vite client
├── docs/            # API contract & integration guide, project specification
└── docker-compose.yml  # Local PostgreSQL
```

## Quick Start

```bash
docker compose up -d postgres          # local PostgreSQL
npm install --workspaces

# Backend → http://localhost:5000/api
cp apps/backend/.env.example apps/backend/.env   # set DATABASE_URL, JWT_SECRET
npm run db:migrate --workspace=apps/backend
npm run dev:backend

# Frontend → http://localhost:5173
cp apps/frontend/.env.example apps/frontend/.env.local
npm run dev:frontend
```

See [`apps/backend/README.md`](apps/backend/README.md) and [`apps/frontend/README.md`](apps/frontend/README.md) for full setup, environment variables, and database workflows.

## Seed data and the admin account

```bash
# in apps/backend/.env
ADMIN_EMAIL=you@example.com
ADMIN_PASSWORD=a-long-password-with-Upper-lower-and-1-digit   # 12+ chars in production

npm run db:seed        # idempotent: run it again any time
```

It creates (or updates) the administrator, the first partner school (Epitech; generate its API key in Admin → Schools) and two fictional public profiles, `maya-demo` (public roadmap) and `theo-demo` (private roadmap). Demo accounts use `.invalid` addresses and have no password, so nobody can sign in as them. Run the app once first so the catalogue exists; the demo roadmaps are built from it.

## Going to production

- Set `NODE_ENV=production`. The API then **refuses to start** with a short or placeholder `JWT_SECRET`, or a `FRONTEND_URL` that is localhost.
- `JWT_EXPIRES_IN` defaults to `15m`. If an old deployment still has `1d` set, remove it: the refresh token keeps people signed in.
- Required: `DATABASE_URL`, `JWT_SECRET` (32+ random chars), `FRONTEND_URL` (exact origin). Recommended: `SITE_URL`, `GROQ_API_KEY`/`GEMINI_API_KEY`, `GITHUB_TOKEN`, OAuth ids. Everything is listed in `apps/backend/.env.example`.
- `render.yaml` deploys the API (migrations run before start; health check on `/api/ready`, which also checks the database). `apps/frontend/vercel.json` rewrites to the SPA and sets security headers.
- Set `VITE_API_URL` (and `VITE_GOOGLE_CLIENT_ID`, `VITE_SITE_URL`) on the frontend host.
- The sitemap is served by the API at `/api/public/sitemap.xml`; point your host's `/sitemap.xml` at it, or replace `public/sitemap.xml`.
- CI runs the type-check, both builds and both test suites.

## Documentation

| Document | Content |
| --- | --- |
| [`docs/frontend-integration-guide.md`](docs/frontend-integration-guide.md) | REST API contract, data models, integration requirements |
| [`docs/TechTalk_Fiche_Projet.docx`](docs/TechTalk_Fiche_Projet.docx) | Project specification |

## Production

| Service | Host |
| --- | --- |
| Frontend | https://t3chtalk.vercel.app |
