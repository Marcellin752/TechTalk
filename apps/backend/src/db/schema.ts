import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, timestamp, index, uniqueIndex, customType, integer } from 'drizzle-orm/pg-core';

/** Any JSON value (arrays included) with the same double-encoding protection. */
const jsonbOf = <T>() =>
  customType<{ data: T; driverData: unknown }>({
    dataType: () => 'jsonb',
    toDriver: (value) => sql`${JSON.stringify(value)}::text::jsonb`,
    fromDriver: (value) => (typeof value === 'string' ? JSON.parse(value) : (value as T)),
  });

/* drizzle-orm 0.30 + postgres-js JSON-encodes jsonb values twice, so an object
   ends up stored as a JSON *string*. An explicit ::jsonb cast on the way in
   (and a defensive parse on the way out) keeps real objects in the column. */
const jsonbObject = customType<{ data: Record<string, unknown>; driverData: unknown }>({
  dataType: () => 'jsonb',
  toDriver: (value) => sql`${JSON.stringify(value)}::text::jsonb`,
  fromDriver: (value) => (typeof value === 'string' ? JSON.parse(value) : (value as Record<string, unknown>)),
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }), // nullable: Google-only accounts have no password
  googleId: varchar('google_id', { length: 255 }).unique(),
  githubId: varchar('github_id', { length: 64 }).unique(),
  githubLogin: varchar('github_login', { length: 100 }), // public handle, shown on the profile
  picture: varchar('picture', { length: 500 }), // avatar URL (Google profile picture)
  role: varchar('role', { length: 20 }).default('user').notNull(), // 'user' or 'admin'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contents = pgTable('contents', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  url: varchar('url', { length: 512 }).notNull().unique(),
  source: varchar('source', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  summary: text('summary'),
  body: text('body'), // full article content as sanitized HTML
  categories: text('categories').array(),
  image: varchar('image', { length: 1000 }),
  embedCode: text('embed_code'),
  // Provider-specific facts (stars, language, topics…) that do not deserve a column each.
  meta: jsonbObject('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  createdAtIdx: index('contents_created_at_idx').on(table.createdAt),
}));

export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  contentId: uuid('content_id').references(() => contents.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  contentCreatedIdx: index('comments_content_created_idx').on(table.contentId, table.createdAt),
}));

export const bookmarks = pgTable('bookmarks', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  contentId: uuid('content_id').references(() => contents.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userContentUniqueIdx: uniqueIndex('bookmarks_user_content_unique_idx').on(table.userId, table.contentId),
}));

export const readingHistory = pgTable('reading_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  contentId: uuid('content_id').references(() => contents.id, { onDelete: 'cascade' }).notNull(),
  readAt: timestamp('read_at').defaultNow().notNull(),
}, (table) => ({
  userContentIdx: index('reading_history_user_content_idx').on(table.userId, table.contentId),
}));

export interface GithubLanguageShare { name: string; share: number }
export interface GithubTopRepo {
  name: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  url: string;
  pushedAt: string;
}

/** A snapshot of the user's public GitHub activity, refreshed on demand. */
export const githubProfiles = pgTable('github_profiles', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).primaryKey(),
  login: varchar('login', { length: 100 }).notNull(),
  name: varchar('name', { length: 200 }),
  bio: text('bio'),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  htmlUrl: varchar('html_url', { length: 300 }),
  publicRepos: integer('public_repos').default(0).notNull(),
  followers: integer('followers').default(0).notNull(),
  totalStars: integer('total_stars').default(0).notNull(),
  languages: jsonbOf<GithubLanguageShare[]>()('languages').notNull(),
  topRepos: jsonbOf<GithubTopRepo[]>()('top_repos').notNull(),
  syncedAt: timestamp('synced_at').defaultNow().notNull(),
});
