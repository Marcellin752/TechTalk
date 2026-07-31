# Deployment Guide — TechTalk (Render + Vercel)

This guide explains how to deploy the TechTalk stack:

- **Backend** (Fastify + TypeScript + Drizzle ORM + PostgreSQL) → deployed as a **Render Web Service** with a managed PostgreSQL database.
- **Frontend** (React + Vite) → deployed as a **Vercel** static site.

> Prerequisites: a GitHub account with this repository pushed, a [Render](https://render.com) account, and a [Vercel](https://vercel.com) account.

---

## 1. Backend on Render

The backend lives in `apps/backend/`. It starts with `npm run build` (compiles TypeScript to `dist/`) then `npm start` (`node dist/index.js`). It listens on `process.env.PORT || 5000` and binds to `0.0.0.0`.

### 1.1 Create the PostgreSQL database
1. In Render, go to **New → PostgreSQL**.
2. Name it `teachtalk-db`, choose a region close to your service, and pick a plan.
3. Once created, copy the **Internal Database URL** (or External) — you will use it as `DATABASE_URL`.

### 1.2 Create the Web Service
1. In Render, go to **New → Web Service** and connect this GitHub repo.
2. Configure the service:

| Field | Value |
| --- | --- |
| **Runtime** | Node |
| **Root Directory** | `apps/backend` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |
| **Instance Type** | Free (or Starter for always-on) |

> Render auto-detects `PORT` via the environment; the Fastify server already reads `process.env.PORT`, so no change is needed.

### 1.3 Environment Variables
In the Web Service **Environment** tab, add:

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the PostgreSQL Internal Database URL from step 1.1 |
| `JWT_SECRET` | a long random secret string (e.g. `openssl rand -hex 32`) |
| `YOUTUBE_API_KEY` | your Google Cloud YouTube Data API v3 key |

### 1.4 Sync the database schema
After the first deploy, the `users` and `contents` tables must exist. From the Render shell (or locally with the production `DATABASE_URL`) run:

```bash
cd apps/backend
npm run db:push      # recommended for simple schema sync
# or, to apply migration files:
npm run db:migrate
```

The automation workers (Dev.to, YouTube via node-cron) start automatically on server boot and sync hourly.

### 1.5 Verify
Once live, open `https://<your-service>.onrender.com/api/health`. You should see:
```json
{ "status": "OK", "message": "TechTalk API is running smoothly" }
```

Copy the deployed backend base URL (e.g. `https://teachtalk-backend.onrender.com`) — you will need it for the frontend in step 2.3.

---

## 2. Frontend on Vercel

The frontend lives in `apps/frontend/` and builds to `dist/` via `vite build`.

> ⚠️ **Important:** the API base URL is currently hardcoded in `apps/frontend/src/services/api.ts`:
> ```ts
> const API_URL = 'http://localhost:5000/api';
> ```
> Before deploying, change it to your deployed backend URL:
> ```ts
> const API_URL = 'https://<your-service>.onrender.com/api';
> ```
> (Ideally make this configurable via an env var — see "Recommended improvements" below.)

### 2.1 Import the project
1. In Vercel, go to **Add New → Project** and import this GitHub repo.
2. Configure the project:

| Field | Value |
| --- | --- |
| **Framework Preset** | Vite |
| **Root Directory** | `apps/frontend` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

Vercel will auto-detect most of these from the Vite setup; set the **Root Directory** to `apps/frontend` explicitly.

### 2.2 Environment Variables (optional)
If you make the API URL configurable, add:

| Key | Value |
| --- | --- |
| `VITE_API_URL` | `https://<your-service>.onrender.com/api` |

### 2.3 Deploy
Click **Deploy**. Once finished, Vercel gives you a URL (e.g. `https://techtalk-frontend.vercel.app`).

---

## 3. Wiring backend ↔ frontend

1. Deploy the backend first and confirm `/api/health` works.
2. Set the frontend's `API_URL` to the Render backend URL (edit `apps/frontend/src/services/api.ts`, or use `VITE_API_URL`).
3. Redeploy the frontend so the new API URL is bundled.

CORS is currently configured as `origin: '*'` in `apps/backend/src/index.ts`, so the Vercel domain is allowed to call the API by default. For production hardening, restrict it to your Vercel URL.

---

## 4. Deployment checklist

- [ ] Render PostgreSQL database created
- [ ] Render Web Service created with `apps/backend` root, `npm install && npm run build`, `npm start`
- [ ] Backend env vars set: `DATABASE_URL`, `JWT_SECRET`, `YOUTUBE_API_KEY`, `NODE_ENV=production`
- [ ] `npm run db:push` / `db:migrate` executed against production DB
- [ ] `/api/health` returns OK
- [ ] Frontend `API_URL` updated to Render URL
- [ ] Vercel project uses `apps/frontend` root, builds `dist`
- [ ] Frontend redeployed after API URL change

---

## 5. Notes & discrepancies found

- **Endpoint path:** `apps/backend/src/index.ts` registers content routes with prefix `/api/content` (singular), so the feed endpoint is **`GET /api/content`**, not `/api/contents` as written in `docs/frontend-integration-guide.md`. The frontend's `getContents()` already calls `/api/content` correctly.
- **JWT fallback:** `apps/backend/src/index.ts` falls back to a hardcoded secret if `JWT_SECRET` is missing. Always set `JWT_SECRET` in production or tokens will be insecure.
- **CORS:** wide open (`*`). Tighten for production.

## 6. Recommended improvements (not yet done)

- Replace the hardcoded `API_URL` in `src/services/api.ts` with `import.meta.env.VITE_API_URL` and provide a `.env` / `.env.example` for the frontend.
- Add a `render.yaml` (Infra-as-Code) and a `vercel.json` for reproducible deployments.
- Lock down CORS to the specific Vercel domain.
