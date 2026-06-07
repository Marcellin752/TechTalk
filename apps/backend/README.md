# Tech Talk - Backend

## Database Setup (Drizzle + PostgreSQL)

We have successfully integrated **Drizzle ORM** and synchronized our local PostgreSQL database with our TypeScript schema! The initial tables for our MVP (`users` and `articles`) are officially live.

### How to get started

If you are pulling this progress to your local machine, follow these steps to get your backend environment up and running perfectly:

#### 1. Environment Configuration
Create a `.env` file in `apps/backend/` by copying the example file:
```bash
cp .env.example .env
```

Inside your .env, update your database connection string with your local PostgreSQL credentials. If you set up your database with the user postgres and password postgres, it should look like this:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/teachtalk_db
```

#### 2. Install Dependencies

Make sure all required packages (including drizzle-kit and driver packages) are installed on your machine:

```bash
npm install
```

#### 3. Database Sync & Operations

You don't need to manually write SQL to update your schema. Use the following commands:

##### Generate Migrations: (Already done for the current schema, but run this if you modify src/db/schema.ts)

```bash
npm run db:generate
```

##### Apply Migrations: Run this to push the current migration files into your local PostgreSQL instance and create the tables:

```bash
npm run db:migrate
```

