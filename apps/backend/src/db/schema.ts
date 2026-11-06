import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, timestamp, index, uniqueIndex, customType, integer, boolean } from 'drizzle-orm/pg-core';

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
  // §14 asks for a username: the public handle a profile is addressed by, so a
  // student's link never carries their email. Null until onboarding sets it.
  username: varchar('username', { length: 40 }).unique(),
  role: varchar('role', { length: 20 }).default('user').notNull(), // 'user' or 'admin'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// §8 asks for one Content abstraction every provider normalises into. The
// columns below are what recommendation and deduplication need on top of a
// link: who made it, when it was really published, and the provider's own id.
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
  typeIdx: index('contents_type_idx').on(table.type),
  sourceIdx: index('contents_source_idx').on(table.source),
  // A provider re-listing the same item must not create a second row, even
  // when it hands over a URL that differs by a tracking parameter.
  sourceExternalIdx: uniqueIndex('contents_source_external_idx').on(table.source, table.externalId),
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

// A bookmark means "read it later"; a like is the user affirming the content
// itself. Both are per-user, idempotent, and survive a session change.
export const likes = pgTable('likes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  contentId: uuid('content_id').references(() => contents.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userContentUniqueIdx: uniqueIndex('likes_user_content_unique_idx').on(table.userId, table.contentId),
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

/** What the learner told us at the start; everything in their path derives from it. */
export const learningProfiles = pgTable('learning_profiles', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).primaryKey(),
  goal: varchar('goal', { length: 30 }).notNull(),
  level: varchar('level', { length: 20 }).notNull(),
  languages: text('languages').array().notNull(),
  hoursPerWeek: integer('hours_per_week').notNull(),
  style: varchar('style', { length: 20 }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export interface PathStage { index: number; title: string; objective: string; minutes: number }

/** A generated, ordered learning path. Only one is active per user; older ones are kept. */
export const learningPaths = pgTable('learning_paths', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  goal: varchar('goal', { length: 30 }).notNull(),
  level: varchar('level', { length: 20 }).notNull(),
  hoursPerWeek: integer('hours_per_week').notNull(),
  totalMinutes: integer('total_minutes').notNull(),
  stages: jsonbOf<PathStage[]>()('stages').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userActiveIdx: index('learning_paths_user_active_idx').on(table.userId, table.active),
}));

/** One resource in a path, with the learner's progress on it. */
export const learningSteps = pgTable('learning_steps', {
  id: uuid('id').defaultRandom().primaryKey(),
  pathId: uuid('path_id').references(() => learningPaths.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  contentId: uuid('content_id').references(() => contents.id, { onDelete: 'cascade' }).notNull(),
  stage: integer('stage').notNull(),
  position: integer('position').notNull(),
  kind: varchar('kind', { length: 20 }).notNull(), // orient | learn | practice | project | read
  minutes: integer('minutes').notNull(),
  status: varchar('status', { length: 12 }).default('todo').notNull(), // todo | doing | done
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  pathPositionIdx: index('learning_steps_path_position_idx').on(table.pathId, table.position),
  pathContentUnique: uniqueIndex('learning_steps_path_content_unique').on(table.pathId, table.contentId),
}));

export interface KairosSource { n: number; id: string; type: string; title: string; url: string; source: string }

/** A chat with Kairos. The history page lists these. */
export const kairosConversations = pgTable('kairos_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 120 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userUpdatedIdx: index('kairos_conversations_user_updated_idx').on(table.userId, table.updatedAt),
}));

export const kairosMessages = pgTable('kairos_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  conversationId: uuid('conversation_id').references(() => kairosConversations.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 12 }).notNull(), // user | assistant
  content: text('content').notNull(),
  sources: jsonbOf<KairosSource[]>()('sources'),
  model: varchar('model', { length: 80 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  conversationIdx: index('kairos_messages_conversation_idx').on(table.conversationId, table.createdAt),
  userDayIdx: index('kairos_messages_user_day_idx').on(table.userId, table.createdAt),
}));

/** What a learner chooses to show to others. Everything is private until they opt in. */
export const profileSettings = pgTable('profile_settings', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).primaryKey(),
  handle: varchar('handle', { length: 30 }).unique(),
  isPublic: boolean('is_public').default(false).notNull(),
  showProjects: boolean('show_projects').default(true).notNull(),
  showInterests: boolean('show_interests').default(true).notNull(),
  /** The learning path ("roadmap") is shown only when this is on, whatever else is public. */
  pathPublic: boolean('path_public').default(false).notNull(),
  interests: text('interests').array().default(sql`'{}'::text[]`).notNull(),
  // Self-written profile details; they win over what GitHub says.
  bio: varchar('bio', { length: 280 }),
  location: varchar('location', { length: 80 }),
  website: varchar('website', { length: 200 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  publicIdx: index('profile_settings_public_idx').on(table.isPublic, table.updatedAt),
}));
