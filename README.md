# Tech Talk Project

TechTalk is an educational scrolling application designed for tech professionals and students. It aggregates tech articles, videos, and news from top-tier platforms (like YouTube, Reddit, and RSS feeds) into a single, personalized feed based on user specialties and interests. 

The goal is to transform passive scrolling moments into natural, productive, and engaging tech watch sessions.

---
##  Project Structure

```text
techtalk/
├── .github/
│   └── workflows/          # CI/CD pipelines (e.g., automated tests)
├── apps/
│   ├── backend/            # Fastify server source code
│   │   ├── src/
│   │   │   ├── config/     # Configuration (env variables, databases, API keys)
│   │   │   ├── controllers/# Route logic (authentication, feed, etc.)
│   │   │   ├── models/     # Database schemas and data types
│   │   │   ├── routes/     # REST API endpoints definition
│   │   │   ├── services/   # Business logic (e.g., likes management)
│   │   │   ├── scrapers/   # Aggregation module (YouTube, Reddit, RSS)
│   │   │   └── index.ts    # Fastify application entry point
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   │
│   └── frontend/           # React application source code
│       ├── src/
│       │   ├── assets/     # Images, logos, global styles
│       │   ├── components/ # Reusable components (Card, Navbar, Button)
│       │   ├── hooks/      # Custom React hooks (e.g., useAuth, useFeed)
│       │   ├── pages/      # Pages (Login, Onboarding, Feed, Saved)
│       │   ├── services/   # API calls (Axios/Fetch) to the Backend
│       │   ├── types/      # Frontend-side TypeScript types
│       │   └── main.tsx    # React application entry point
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
│
├── docs/                   # Global documentation, database diagrams, etc.
├── .gitignore              # Files ignored by Git (node_modules, .env)
├── README.md               # Main project README
└── TechTalk_Fiche_Projet.docx # Project description sheet
```
