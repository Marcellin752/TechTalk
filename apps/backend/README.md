# TechTalk Backend

Fastify + TypeScript REST API for TechTalk, with PostgreSQL (Drizzle ORM) persistence and hourly content aggregation workers.

## Stack

- Fastify, TypeScript, Drizzle ORM, PostgreSQL
- `@fastify/jwt` (Bearer tokens), `bcrypt`, `google-auth-library`
- Validation, rate limiting, and node-cron scheduled workers

## Getting Started

### 1. Environment Configuration

```bash
cp .env.example .env
```

Set `DATABASE_URL` and `JWT_SECRET` (a long random string). Add `YOUTUBE_API_KEY` to enable the YouTube provider. `GOOGLE_CLIENT_ID` is optional but required for Google Sign-In; `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` are optional (see [Providers](#providers)).

### 2. Run

```bash
npm install
npm run db:migrate     # apply migrations (src/db/migrations)
npm run dev            # dev server with watch mode
```

A local PostgreSQL instance is easy to start with the root `docker-compose.yml`:

```bash
docker compose up -d postgres
```

### 3. Database Workflows

| Command | Use |
| --- | --- |
| `db:migrate` | Apply versioned migrations (recommended for shared/production databases) |
| `db:generate` | Generate a new migration after editing `src/db/schema.ts` |
| `db:push` | Sync schema directly — **local prototyping only**, never mix with migrations |
| `test` | Run the Vitest suite (`apps/backend/src/controllers/*.test.ts`) |

## Providers

Aggregation runs on startup and then hourly (`node-cron`), upserting deduplicated content:

| Provider | Source | Required env |
| --- | --- | --- |
| Dev.to | Latest trending articles (TypeScript tag) | — |
| YouTube | Latest videos from configured tech channels | `YOUTUBE_API_KEY` |
| RSS | Global tech news feeds | — |
| Reddit | Tech communities | `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` (optional, bypasses cloud IP blocking) |

## Schema

Defined in `src/db/schema.ts`; versioned migrations live in `src/db/migrations/` (latest: `0009`).

| Table | Purpose |
| --- | --- |
| `users` | Accounts: `id`, `email` (unique), `password` (hashed, nullable for Google-only), `name`, `role` (`user`/`admin`), `picture`, `created_at` |
| `contents` | Aggregated items: `id`, `title`, `url` (unique), `source`, `type` (`article`/`video`/`social_post`), `summary`, `body`, `categories`, `image`, `embedCode`, `created_at` |
| `bookmarks` | Per-user saved contents (`user_id`, `content_id`, `created_at`) |
| `reading_history` | Read tracking (`user_id`, `content_id`, `read_at`) |

## API

Routes are organized in `src/routes/` and mounted under `/api`:

- **Auth** (`/api/auth`): `POST register`, `POST login`, `POST google`, `POST refresh`, `GET me`, `PATCH profile`
- **Content** (`/api/content`): `GET /` (paginated, searchable, filterable), `POST /` (admin), bookmarks and reading-history endpoints

Full request/response contract: [`docs/frontend-integration-guide.md`](../../docs/frontend-integration-guide.md).

## Deployment

`npm run build` (tsc) then `npm start`. The production backend runs on Render; migrations must be applied against the production database (via `npm run db:migrate` or a release command).