import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

// 1. Users Table (For authentication, registration, and user profiles)
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // Passwords must be hashed before saving
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Articles / Tech Content Table (To store data fetched by your scrapers)
export const articles = pgTable('articles', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  url: text('url').notNull().unique(), // Unique constraint prevents duplicate scrapings
  source: text('source').notNull(), // e.g., 'Dev.to', 'Medium', 'TechCrunch'
  summary: text('summary'), // Textual summary or preview of the tech post
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
