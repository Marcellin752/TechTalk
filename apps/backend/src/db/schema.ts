import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, text, timestamp, index, uniqueIndex, customType, integer, boolean, smallint } from 'drizzle-orm/pg-core';

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

/** What the learner told us at the start; everything in their path derives from it. */
export const learningProfiles = pgTable('learning_profiles', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).primaryKey(),
  goal: varchar('goal', { length: 30 }).notNull(),
  level: varchar('level', { length: 20 }).notNull(),
  languages: text('languages').array().notNull(),
  hoursPerWeek: integer('hours_per_week').notNull(),
  style: varchar('style', { length: 20 }).notNull(),
  // Optional: what the learner studies at school, used to line the path up with it.
  school: varchar('school', { length: 80 }),
  /** Set when the learner picked a school that has joined TechTalk. */
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'set null' }),
  schoolYear: integer('school_year'),
  schoolTopics: text('school_topics').array().default(sql`'{}'::text[]`).notNull(),
  /** Consent: the school sees anonymous group statistics (never individuals). Off by default. */
  shareWithSchool: boolean('share_with_school').default(false).notNull(),
  /** Consent: this learner's progress counts towards better recommendations for everyone. Off by default. */
  shareForRecommendations: boolean('share_for_recommendations').default(false).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export interface PathStage { index: number; title: string; objective: string; minutes: number; /** For a school path: what the project is about, and what kind of stage it is. */ topics?: string[]; kind?: string }

/** What a path was built from, so it can be rebuilt on its own. */
export interface PathSettings {
  goal: string; level: string; languages: string[]; hoursPerWeek: number; style: string;
  /** School paths: the year of the programme. */
  schoolYear?: number | null;
  /** School paths: true while the school's programme has not been confirmed by the school. */
  programmeDraft?: boolean;
}

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
  /** The learner's main path: the one the home page and Kairos follow. Exactly one per learner. */
  active: boolean('active').default(true).notNull(),
  /** personal | school | custom */
  kind: varchar('kind', { length: 10 }).default('personal').notNull(),
  settings: jsonbOf<PathSettings>()('settings'),
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
  /** The learner's rating of an answer: 1 helpful, -1 not helpful. */
  feedback: smallint('feedback'),
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

/** A long-lived, rotating session token. Only its SHA-256 is stored, never the token. */
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  /** Every token that descends from one sign-in shares a family, so theft can revoke them all. */
  familyId: uuid('family_id').notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  userAgent: varchar('user_agent', { length: 200 }),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdx: index('refresh_tokens_user_idx').on(table.userId),
  familyIdx: index('refresh_tokens_family_idx').on(table.familyId),
}));

/** The learner's calendar: planned study sessions, school deadlines, events. */
export const calendarEvents = pgTable('calendar_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  kind: varchar('kind', { length: 12 }).notNull(), // study | school | deadline | event
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  notes: varchar('notes', { length: 500 }),
  /** A study session can point at the path step it covers. */
  stepId: uuid('step_id').references(() => learningSteps.id, { onDelete: 'set null' }),
  contentId: uuid('content_id').references(() => contents.id, { onDelete: 'set null' }),
  done: boolean('done').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userStartIdx: index('calendar_events_user_start_idx').on(table.userId, table.startsAt),
}));

/** Who did what in the admin area. Kept even if the admin or the target is deleted later. */
export const adminAudit = pgTable('admin_audit', {
  id: uuid('id').defaultRandom().primaryKey(),
  adminId: uuid('admin_id').references(() => users.id, { onDelete: 'set null' }),
  adminEmail: varchar('admin_email', { length: 255 }).notNull(),
  action: varchar('action', { length: 40 }).notNull(),
  target: varchar('target', { length: 200 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  createdIdx: index('admin_audit_created_idx').on(table.createdAt),
}));

export interface ProgrammeProject {
  name: string;
  summary?: string;
  /** What it teaches: used to pick resources for it. */
  topics: string[];
  kind?: 'piscine' | 'project' | 'module' | 'internship';
  /** Roughly how long the work takes, to size the resources around it. */
  hours?: number;
}
export interface ProgrammeYear { year: number; title: string; summary?: string; projects: ProgrammeProject[] }
/** A school's programme: year by year, the modules and projects students go through. */
export interface Programme {
  /** "draft" until the school itself has checked it. */
  status?: 'draft' | 'confirmed';
  years: ProgrammeYear[];
}
export interface SchoolCurriculum { years: string[][]; programme?: Programme }

/** A school that has joined: its curriculum, and the key it uses to talk to the partner API. */
export const schools = pgTable('schools', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 40 }).notNull().unique(),
  name: varchar('name', { length: 80 }).notNull(),
  contactEmail: varchar('contact_email', { length: 255 }),
  curriculum: jsonbOf<SchoolCurriculum>()('curriculum').notNull(),
  active: boolean('active').default(true).notNull(),
  /** SHA-256 of the API key; the key itself is shown once and never stored. */
  apiKeyHash: varchar('api_key_hash', { length: 64 }).unique(),
  apiKeyPrefix: varchar('api_key_prefix', { length: 12 }),
  apiKeyCreatedAt: timestamp('api_key_created_at'),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

/** A deadline, exam or event a school pushes into its learners' calendars. */
export const schoolEvents = pgTable('school_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }).notNull(),
  /** The school's own id for it, so pushing the same event again updates it. */
  externalId: varchar('external_id', { length: 100 }).notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  kind: varchar('kind', { length: 12 }).notNull(),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  notes: varchar('notes', { length: 500 }),
  /** Only learners of this year see it; null means every year. */
  year: integer('year'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  schoolExternalUnique: uniqueIndex('school_events_school_external_unique').on(table.schoolId, table.externalId),
  schoolStartIdx: index('school_events_school_start_idx').on(table.schoolId, table.startsAt),
}));

/* ---- Campus: revisions, past exams, people (only for schools that have joined) ---- */

/** A link to a past exam, a correction, notes… shared with the school's students. */
export const campusResources = pgTable('campus_resources', {
  id: uuid('id').defaultRandom().primaryKey(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }).notNull(),
  /** Who shared it; kept (as null) if they leave. */
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 140 }).notNull(),
  kind: varchar('kind', { length: 12 }).notNull(), // exam | correction | td | notes | cheatsheet
  subject: varchar('subject', { length: 80 }).notNull(),
  /** Academic year of the exam, e.g. 2025. */
  year: integer('year'),
  /** The cursus year it is for (1-8). */
  studyYear: integer('study_year'),
  url: varchar('url', { length: 500 }).notNull(),
  description: varchar('description', { length: 500 }),
  /** Pushed by the school itself through the partner API. */
  official: boolean('official').default(false).notNull(),
  status: varchar('status', { length: 10 }).default('approved').notNull(), // approved | hidden
  votes: integer('votes').default(0).notNull(),
  reports: integer('reports').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  schoolSubjectIdx: index('campus_resources_school_subject_idx').on(table.schoolId, table.subject),
  schoolUrlUnique: uniqueIndex('campus_resources_school_url_unique').on(table.schoolId, table.url),
}));

export const campusResourceVotes = pgTable('campus_resource_votes', {
  resourceId: uuid('resource_id').references(() => campusResources.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: uniqueIndex('campus_resource_votes_pk').on(table.resourceId, table.userId),
}));

export const campusResourceReports = pgTable('campus_resource_reports', {
  resourceId: uuid('resource_id').references(() => campusResources.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  reason: varchar('reason', { length: 200 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: uniqueIndex('campus_resource_reports_pk').on(table.resourceId, table.userId),
}));

/** A revision session students organise for each other. */
export const campusSessions = pgTable('campus_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  schoolId: uuid('school_id').references(() => schools.id, { onDelete: 'cascade' }).notNull(),
  hostId: uuid('host_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 120 }).notNull(),
  subject: varchar('subject', { length: 80 }).notNull(),
  description: varchar('description', { length: 500 }),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  place: varchar('place', { length: 120 }),
  onlineUrl: varchar('online_url', { length: 500 }),
  capacity: integer('capacity').default(8).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  schoolStartIdx: index('campus_sessions_school_start_idx').on(table.schoolId, table.startsAt),
}));

export const campusSessionMembers = pgTable('campus_session_members', {
  sessionId: uuid('session_id').references(() => campusSessions.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => ({
  pk: uniqueIndex('campus_session_members_pk').on(table.sessionId, table.userId),
  userIdx: index('campus_session_members_user_idx').on(table.userId),
}));

/** Opt-in presence in the campus directory. Off until the student turns it on. */
export const campusProfiles = pgTable('campus_profiles', {
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).primaryKey(),
  discoverable: boolean('discoverable').default(false).notNull(),
  headline: varchar('headline', { length: 120 }),
  lookingFor: varchar('looking_for', { length: 12 }), // study-buddy | mentor | mentee | team
  /** How to reach them outside TechTalk (a handle, never required). */
  contact: varchar('contact', { length: 60 }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
