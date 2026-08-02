# Tech Talk - Backend

## Database Setup (Drizzle + PostgreSQL)

We have successfully integrated **Drizzle ORM** and synchronized our local PostgreSQL database with our TypeScript schema! The initial tables for our MVP (`users` and `contents`) are officially live and fully operational.

### How to get started

If you are pulling this project to your local machine, follow these steps to get your backend environment up and running perfectly:

#### 1. Environment Configuration
Create a `.env` file in `apps/backend/` by copying the example file:
```bash
cp .env.example .env
```
Inside your .env, update your database connection string and secure credentials:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/teachtalk_db
JWT_SECRET=your_jwt_secret_key_here
YOUTUBE_API_KEY=your_google_cloud_youtube_api_key_here
```

#### 2. Install Dependencies

Make sure all required packages are properly installed on your machine:
```bash
npm install
```

#### 3. Database Sync & Operations

Two workflows exist; pick one and stick to it:

* **Migrations (recommended for shared/production databases):** versioned SQL files in `src/db/migrations/`. Apply them with:

```bash
npm run db:migrate
```

* **Push (quick local prototyping only):** syncs the schema directly to your database without versioned files:

```bash
npm run db:push
```

Do **not** mix both on the same database — `db:push` can drift from the migration history. To create a new migration after editing `src/db/schema.ts`:

```bash
npm run db:generate
```

## Automation Service (Background Workers)

The backend embeds a modular automation engine powered by node-cron. Upon server startup, an immediate data sync is executed, and the worker then schedules itself to run every hour to pull fresh technical content while safely preserving your API quotas.

The architecture is split into independent data providers:

* Dev.to Provider: Fetches the latest trending technical articles (filtered by the TypeScript tag).

* YouTube Provider: Connects to the YouTube Data API v3 using your environment key to pull the latest videos from specified tech channels.

## Database Schema (Data Models)

Here is the current structure of our database tables defined in `src/db/schema.ts`:

### 1. `users` Table
This table stores user credentials and roles to handle RBAC (Role-Based Access Control) security.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | Primary Key, Default: uuid_generate_v4() | Unique identifier for each user |
| `email` | `varchar(255)` | Unique, Not Null | User's email address used for login |
| `password` | `varchar(255)` | Not Null | Hashed password (managed via bcrypt) |
| `name` | `varchar(100)` | Not Null | User's full name or display name |
| `role` | `varchar(50)` | Default: 'user' | Access role (`user`, `admin`) |
| `created_at` | `timestamp` | Default: now() | Account creation timestamp |

### 2. `contents` Table
This table centralizes and aggregates all media items collected by our workers or manually created by administrators.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | Primary Key, Default: uuid_generate_v4() | Unique identifier for each content piece |
| `title` | `varchar(255)` | Not Null | Title of the article or video |
| `url` | `varchar(512)` | Unique, Not Null | Direct link to the source content origin |
| `source` | `varchar(100)` | Not Null | Platform origin (e.g., `Dev.to`, `YouTube`) |
| `type` | `varchar(50)` | Not Null | Media format (`article`, `video`) |
| `summary` | `text` | - | Short snippet or description text |
| `embedCode` | `text` | Nullable | HTML Iframe code for direct video embedding |
| `created_at` | `timestamp` | Default: now() | Insertion timestamp into our database |

