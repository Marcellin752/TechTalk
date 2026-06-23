import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).default('user').notNull(), // 'user' or 'admin'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contents = pgTable('contents', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  url: varchar('url', { length: 512 }).notNull().unique(),
  source: varchar('source', { length: 100 }).notNull(), // e.g., 'YouTube', 'Dev.to'
  type: varchar('type', { length: 50 }).notNull(), // 'video' or 'article'
  summary: text('summary'),
  embedCode: text('embed_code'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
