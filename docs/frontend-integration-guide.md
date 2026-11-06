# TechTalk — API Contract & Frontend Integration Guide

This document defines the HTTP contract between the TechTalk frontend and backend, the data models exposed by the API, and the integration requirements for the presentation layer.

---

## 1. Architectural Context

| Layer | Technology |
| --- | --- |
| Backend | Fastify, TypeScript, Drizzle ORM, PostgreSQL |
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Authentication | Stateful JWT via `@fastify/jwt` (Bearer token) |
| Content aggregation | Automated workers (`node-cron`, hourly) fetching from Dev.to, YouTube Data API v3, and global RSS feeds |
| Base URL | `http://localhost:5000/api` (local) — overridable via `VITE_API_URL` |

### Authentication

All protected endpoints require the header:

```
Authorization: Bearer <jwt_token>
```

Tokens are signed with a 1-day expiration. Access tokens may be renewed via `POST /api/auth/refresh` (see [2.5](#25-refresh-a-token)).

---

## 2. REST API Endpoints

### 2.1 Register a New Account

**`POST /api/auth/register`** — `application/json`

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "secure_password_here"
}
```

**`201 Created`**

```json
{
  "message": "User registered successfully!",
  "user": {
    "id": "a3b89c00-...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "user",
    "picture": null
  }
}
```

Constraints: email must match a valid format; password must be 12–100 characters and contain at least one uppercase letter, one lowercase letter, one digit, and one special character.

### 2.2 User Login

**`POST /api/auth/login`** — `application/json`

```json
{
  "email": "jane@example.com",
  "password": "secure_password_here"
}
```

**`200 OK`**

```json
{
  "message": "Login successful!",
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": {
    "id": "a3b89c00-...",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "user",
    "picture": null
  }
}
```

### 2.3 Google Sign-In

**`POST /api/auth/google`** — `application/json`

```json
{
  "credential": "<google_id_token>"
}
```

The ID token is verified against Google's certificate. A new account is created on first sign-in (passwordless). Returns the same shape as [2.2](#22-user-login).

### 2.4 Refresh a Token

**`POST /api/auth/refresh`** — `Bearer <expired_or_valid_token>`

Server-side verification without expiration enforcement, up to a 30-day grace period. Returns the same shape as [2.2](#22-user-login) with a fresh token.

```json
{
  "message": "Token refreshed successfully!",
  "token": "eyJhbGciOiJIUzI1NiIsIn...",
  "user": { "id": "...", "name": "Jane Doe", "email": "jane@example.com", "role": "user", "picture": null }
}
```

### 2.5 Current User & Profile

**`GET /api/auth/me`** — returns `{ "user": { ... } }` (same user shape as above).

**`PATCH /api/auth/profile`** — `application/json`

```json
{ "name": "Jane D." }
```

Returns `{ "message": "Profile updated successfully!", "user": { ... } }`.

> Note: all authentication routes are rate-limited to 20 requests per minute per client.

---

## 3. Content & Feed Module

### 3.1 Fetch Aggregated Feed

**`GET /api/content`** — protected

| Query parameter | Type | Default | Max | Description |
| --- | --- | --- | --- | --- |
| `limit` | number | `50` | `100` | Number of items to return |
| `offset` | number | `0` | — | Number of items to skip |
| `search` | string | — | — | Case-insensitive match on title, summary, or source |
| `type` | string | — | — | `article` `\|` `video` `\|` `social_post` |
| `categories` | string | — | — | Comma-separated list, matches any category |

**`200 OK`** — items ordered by `created_at` descending:

```json
[
  {
    "id": "8f4b23b4-e283-4a6c-941d-d9b8e23f11a4",
    "title": "Understanding TypeScript 5.5 Features",
    "url": "https://dev.to/example/typescript-features",
    "source": "Dev.to",
    "type": "article",
    "summary": "A deep dive into the latest type-checking enhancements...",
    "embedCode": null,
    "createdAt": "2026-06-23T20:44:00.000Z"
  },
  {
    "id": "1c2b3a4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "title": "Building Next-Gen Robotics with Assembly",
    "url": "https://www.youtube.com/watch?v=robotics-vid",
    "source": "YouTube",
    "type": "video",
    "summary": "A video exploring low-level control systems...",
    "embedCode": "<iframe ...></iframe>",
    "createdAt": "2026-06-23T21:12:00.000Z"
  }
]
```

### 3.2 Create Content (admin)

**`POST /api/content`** — protected, `role: admin`

```json
{
  "title": "My Article",
  "url": "https://example.com/article",
  "source": "Custom",
  "type": "article",
  "summary": "..."
}
```

**`201 Created`** — returns `{ "message": "...", "content": { ... } }`. Duplicate URLs are rejected with `409`.

### 3.3 Bookmarks

| Endpoint | Description |
| --- | --- |
| `GET /api/content/bookmarks` | List the current user's bookmarked content (full content objects) |
| `POST /api/content/bookmarks` | Body `{ "contentId": "..." }` → `201`; idempotent |
| `DELETE /api/content/bookmarks/:contentId` | Remove a bookmark → `200` |

### 3.4 Reading History

| Endpoint | Description |
| --- | --- |
| `POST /api/content/read` | Body `{ "contentId": "..." }` → records a read → `201` |
| `POST /api/content/read/batch` | Body `{ "contentIds": ["...", "..."] }` → bulk sync, skips already-read and unknown ids → `200` |
| `GET /api/content/read` | Returns `{ "readIds": string[], "readDates": string[] }` (ISO dates of first reads) |

---

## 4. Data Models

### Content object (`contents` table)

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `title` | string | Title of the post/video |
| `url` | string | Canonical link to the source platform (unique) |
| `source` | string | Platform origin — `Dev.to`, `YouTube`, `TechCrunch`, etc. |
| `type` | `article` `\|` `video` `\|` `social_post` | Media format |
| `summary` | string | Text snippet or description |
| `body` | string \| null | Full article body |
| `categories` | string[] | Auto-classified categories |
| `image` | string \| null | Thumbnail/cover URL |
| `embedCode` | string \| null | Safe iframe snippet for video embedding |
| `createdAt` | ISO timestamp | DB insertion time |

### User profile object (`users` table)

| Field | Type | Description |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `email` | string | Unique email |
| `name` | string | Display name |
| `role` | `user` `\|` `admin` | Access level |
| `picture` | string \| null | Avatar URL (set on Google sign-in) |

> Registers/logins expose only `id`, `name`, `email`, `role`, `picture` — never the password hash.