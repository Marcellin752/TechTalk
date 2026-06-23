# TechTalk - Frontend Integration Guide & API Contract

This document provides the frontend team with the necessary technical specifications, data models, and API endpoints to begin building the presentation layer and integrating with the backend.

---

##  Architectural Context
* **Backend Stack:** Fastify, TypeScript, Drizzle ORM, PostgreSQL.
* **Authentication:** Stateful JWT via `@fastify/jwt` (Token must be passed in the `Authorization: Bearer <token>` header).
* **Data Refresh Rate:** Automated workers (`node-cron`) sync data from **Dev.to**, **YouTube API v3**, and global **RSS feeds** once every hour.

---

## Database Models & Payload Structures

When fetching data from the backend, components should expect objects matching the following strict structures:

### 1. Unified Content Object (`contents` table)
This structure represents any article or video aggregated by the background services.

```typescript
interface Content {
  id: string;          // UUID v4 format
  title: string;       // Clean text title of the post/video
  url: string;         // Canonical link to the source platform
  source: string;      // Platform origin: 'Dev.to', 'YouTube', 'TechCrunch', etc.
  type: 'article' | 'video'; // Media format indicator
  summary: string;     // Text snippet, content body, or description
  embedCode: string | null; // Safe HTML Iframe snippet for direct YouTube embedding
  created_at: string;  // ISO timestamp of DB insertion
}
```

### 2. User Authentication Profile (`users` table)
Returned upon successful registration or login sessions.

```typescript
interface UserProfile {
  id: string;          // UUID v4 format
  email: string;       // Unique user email
  name: string;        // Account display name
  role: 'user' | 'admin'; // Access privilege level
  createdAt: string;   // Account creation date
}
```

## REST API Endpoints Contract

### Authentication Module

#### 1. Register a New Account
* **Endpoint:** `POST /api/auth/register`
* **Content-Type:** `application/json`
* **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "password": "secure_password_here"
  }
  ```
* **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "user": {
      "id": "a3b89c...",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "user"
    }
  }
  ```
#### 2. User Authentication (Login)
* **Endpoint:** `POST /api/auth/login`
* **Content-Type:** `application/json`
* **Request Body:**
  ```json
  {
    "email": "jane@example.com",
    "password": "secure_password_here"
  }
  ```
* **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": "a3b89c...",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "user"
    }
  }
  ```

###  Content & Feed Module

#### 1. Fetch Aggregated Feed
* **Endpoint:** `GET /api/contents`
* **Headers Required:** `Authorization: Bearer <your_jwt_token>`
* **Query Parameters (Optional Filtering):**
  * `type`: `article` or `video`
  * `source`: `Dev.to`, `YouTube`, `TechCrunch`
* **Success Response (`200 OK`):**
  ```json
  [
    {
      "id": "8f4b23b4-e283-4a6c-941d-d9b8e23f11a4",
      "title": "Understanding TypeScript 5.5 Features",
      "url": "[https://dev.to/example/typescript-features](https://dev.to/example/typescript-features)",
      "source": "Dev.to",
      "type": "article",
      "summary": "A deep dive into the latest type-checking enhancements...",
      "embedCode": null,
      "created_at": "2026-06-23T20:44:00.000Z"
    },
    {
      "id": "1c2b3a4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "title": "Building Next-Gen Robotics with Assembly",
      "url": "[https://www.youtube.com/watch?v=robotics-vid](https://www.youtube.com/watch?v=robotics-vid)",
      "source": "YouTube",
      "type": "video",
      "summary": "A video exploring low-level control systems and hardware architecture.",
      "embedCode": "<iframe width=\"560\" height=\"315\" src=\"[https://www.youtube.com/embed/robotics-vid](https://www.youtube.com/embed/robotics-vid)\" ...></iframe>",
      "created_at": "2026-06-23T21:12:00.000Z"
    }
  ]
  ```
