# TechTalk Frontend

React + TypeScript client for the TechTalk platform: a personalized feed of tech articles, videos, and news.

## Stack

- React 18, TypeScript, Vite
- Tailwind CSS with shadcn/ui-style components
- React Router, TanStack Query

## Getting Started

```bash
cd apps/frontend
npm install
cp .env.example .env.local   # then edit if needed
npm run dev                  # http://localhost:5173
```

### Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `VITE_API_URL` | Yes | `http://localhost:5000/api` | Backend API base URL (no trailing slash) |
| `VITE_GOOGLE_CLIENT_ID` | No | — | Google OAuth web client ID; enables "Continue with Google" |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and production build |
| `npm run preview` | Preview the production build locally |

## Key Behaviors

- **Authentication**: email/password or Google Sign-In; JWT stored in `localStorage`; automatic refresh 10 minutes before expiry; 401 retry on network failures.
- **Feed**: paginated grid with infinite scroll and pull-to-refresh; search by title/summary/source; filter by type and category.
- **Reading history**: reads recorded locally and synced to the backend (`/api/content/read/batch`).
- **Saved items**: per-user bookmarks managed through the backend.