# TechTalk

TechTalk is an educational scrolling application for tech professionals and students. It aggregates articles, videos, and news from top-tier platforms — Dev.to, YouTube, and global RSS feeds — into a single personalized feed, turning passive scrolling into productive tech watch sessions.

## Features

- **Personalized feed** — articles and videos aggregated hourly by background workers (`node-cron`), with search, type, and category filters
- **Authentication** — email/password registration or Google Sign-In, with automatic session refresh
- **Bookmarks & reading history** — per-user saved content and read tracking, synced across devices
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

## Documentation

| Document | Content |
| --- | --- |
| [`docs/frontend-integration-guide.md`](docs/frontend-integration-guide.md) | REST API contract, data models, integration requirements |
| [`docs/TechTalk_Fiche_Projet.docx`](docs/TechTalk_Fiche_Projet.docx) | Project specification |

## Production

| Service | Host |
| --- | --- |
| Frontend | https://t3chtalk.vercel.app |
