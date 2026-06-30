# Tech Talk Project

TechTalk is an educational scrolling application designed for tech professionals and students. It aggregates tech articles, videos, and news from top-tier platforms (like YouTube, Reddit, and RSS feeds) into a single, personalized feed based on user specialties and interests. 

The goal is to transform passive scrolling moments into natural, productive, and engaging tech watch sessions.

---

## Project Structure

```text
TechTalk/
├── apps/
│   ├── backend/       # Fastify + TypeScript REST API & Background Workers (Drizzle ORM)
│   └── frontend/      # React client application source code
├── docs/              # Global documentation, requirements, and database diagrams
├── package.json       # Root monorepo configuration & workspace orchestration
└── README.md          # This global guide
```
---

## Quick Start

To get the full project up and running locally, follow the specific instructions inside each application folder:

* **Backend & Database Setup:** Go to `apps/backend/README.md` to see how to configure your `.env` file, run `npm install`, and synchronize your local PostgreSQL database using Drizzle migrations (`npm run db:migrate`).
* **Frontend Setup:** Go to `apps/frontend/README.md` to install packages and launch the React development server.

### PostgreSQL via Docker Compose (recommended)

If you just want to bring up PostgreSQL quickly:

```bash
docker compose up -d postgres
```

Then continue with backend setup:

```bash
npm run db:push --workspace=apps/backend
npm run dev:backend
```

---

## Authors

* [Flavio KOUGBADI](https://github.com/Flavio-KOUGBADI)
* [Gloria DJIBRINE](https://github.com/Gloria-bot105)
* [Marcellin SAMBIENI](https://github.com/Marcellin752)
* [Obafemi TAYEWO](https://github.com/olouwafemi-DIne)

---
