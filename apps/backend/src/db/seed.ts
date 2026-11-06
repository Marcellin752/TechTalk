/**
 * Seeds an administrator and two fictional public profiles.
 *
 *   npm run db:seed
 *
 * Safe to run again: everything is matched by email or handle and updated in place.
 * The admin comes from ADMIN_EMAIL / ADMIN_PASSWORD in the environment; the password
 * is never printed. The demo people use ".invalid" addresses (they can never receive
 * mail) and have no password at all, so nobody can sign in as them.
 */
import bcrypt from 'bcrypt';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { config } from '../config/env.js';
import { db } from './db.js';
import { contents, githubProfiles, learningPaths, learningProfiles, learningSteps, profileSettings, users } from './schema.js';
import { generatePath, type CatalogItem, type LearnerProfile } from '../services/learning/generator.js';

const SLOT_TYPES = ['roadmap', 'course', 'video', 'doc', 'exercise', 'repo', 'paper', 'question', 'opportunity'];

interface Demo {
  name: string;
  email: string;
  handle: string;
  bio: string;
  location: string;
  interests: string[];
  pathPublic: boolean;
  learner: LearnerProfile;
  github: { login: string; followers: number; languages: { name: string; share: number }[]; repos: { name: string; description: string; stars: number; forks: number; language: string }[] };
}

const DEMOS: Demo[] = [
  {
    name: 'Maya Laurent',
    email: 'maya.demo@techtalk.invalid',
    handle: 'maya-demo',
    bio: 'Front-end developer who likes design systems and accessible interfaces. Learning Rust on the side.',
    location: 'Lyon, France',
    interests: ['react', 'typescript', 'accessibility', 'design systems', 'rust'],
    pathPublic: true,
    learner: { goal: 'frontend', level: 'intermediate', style: 'mixed', hoursPerWeek: 8, languages: ['TypeScript', 'JavaScript'] },
    github: {
      login: 'maya-demo',
      followers: 142,
      languages: [{ name: 'TypeScript', share: 58 }, { name: 'CSS', share: 22 }, { name: 'Rust', share: 12 }, { name: 'JavaScript', share: 8 }],
      repos: [
        { name: 'tiny-ui', description: 'A small accessible component kit for React.', stars: 412, forks: 38, language: 'TypeScript' },
        { name: 'color-contrast-cli', description: 'Checks WCAG contrast ratios from the terminal.', stars: 96, forks: 7, language: 'Rust' },
      ],
    },
  },
  {
    name: 'Théo Martin',
    email: 'theo.demo@techtalk.invalid',
    handle: 'theo-demo',
    bio: 'Back-end and data engineer. Postgres, queues and the occasional machine-learning experiment.',
    location: 'Montréal, Canada',
    interests: ['python', 'postgres', 'data engineering', 'machine learning', 'devops'],
    pathPublic: false, // this one keeps the roadmap private, to show the privacy switch at work
    learner: { goal: 'data-ai', level: 'basics', style: 'practice', hoursPerWeek: 6, languages: ['Python', 'SQL'] },
    github: {
      login: 'theo-demo',
      followers: 57,
      languages: [{ name: 'Python', share: 64 }, { name: 'SQL', share: 18 }, { name: 'Go', share: 11 }, { name: 'Shell', share: 7 }],
      repos: [
        { name: 'pg-queue-lite', description: 'A job queue on top of PostgreSQL SKIP LOCKED.', stars: 233, forks: 19, language: 'Python' },
        { name: 'notebook-to-pipeline', description: 'Turns exploratory notebooks into scheduled pipelines.', stars: 71, forks: 5, language: 'Python' },
      ],
    },
  },
];

async function seedAdmin() {
  const { adminEmail, adminPassword } = config;
  if (!adminEmail || !adminPassword) {
    console.log('• Admin: skipped (set ADMIN_EMAIL and ADMIN_PASSWORD to create one).');
    return;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) throw new Error('ADMIN_EMAIL is not a valid email address.');
  const strong = adminPassword.length >= 12 && /[a-z]/.test(adminPassword) && /[A-Z]/.test(adminPassword) && /\d/.test(adminPassword);
  if (config.nodeEnv === 'production' && !strong) {
    throw new Error('ADMIN_PASSWORD must have 12+ characters with lower case, upper case and a digit in production.');
  }
  if (!strong) console.warn('  (!) ADMIN_PASSWORD is weak. Fine for local work, not for production.');

  const email = adminEmail.toLowerCase();
  const hash = await bcrypt.hash(adminPassword, 12);
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    await db.update(users).set({ role: 'admin', password: hash }).where(eq(users.id, existing.id));
    console.log(`• Admin: ${email} updated (role admin, password refreshed).`);
  } else {
    await db.insert(users).values({ name: 'Administrator', email, password: hash, role: 'admin' });
    console.log(`• Admin: ${email} created.`);
  }
}

async function loadCatalog(): Promise<CatalogItem[]> {
  return (await db
    .select({ id: contents.id, type: contents.type, title: contents.title, summary: contents.summary, source: contents.source, categories: contents.categories, meta: contents.meta })
    .from(contents)
    .where(and(inArray(contents.type, SLOT_TYPES), sql`(${contents.type} <> 'video' or ${contents.meta}->>'learn' = 'true')`))) as CatalogItem[];
}

async function seedDemo(demo: Demo, catalog: CatalogItem[]) {
  const [found] = await db.select({ id: users.id }).from(users).where(eq(users.email, demo.email)).limit(1);
  const uid = found
    ? found.id
    : (await db.insert(users).values({ name: demo.name, email: demo.email, password: null, githubLogin: demo.github.login }).returning({ id: users.id }))[0]!.id;
  if (found) await db.update(users).set({ name: demo.name, githubLogin: demo.github.login }).where(eq(users.id, uid));

  const settings = {
    handle: demo.handle, isPublic: true, showProjects: true, showInterests: true, pathPublic: demo.pathPublic,
    interests: demo.interests, bio: demo.bio, location: demo.location, updatedAt: new Date(),
  };
  await db.insert(profileSettings).values({ userId: uid, ...settings }).onConflictDoUpdate({ target: profileSettings.userId, set: settings });

  const snapshot = {
    login: demo.github.login, name: demo.name, bio: demo.bio, htmlUrl: `https://github.com/${demo.github.login}`,
    publicRepos: demo.github.repos.length + 6, followers: demo.github.followers,
    totalStars: demo.github.repos.reduce((n, r) => n + r.stars, 0),
    languages: demo.github.languages,
    topRepos: demo.github.repos.map((r) => ({ ...r, url: `https://github.com/${demo.github.login}/${r.name}`, pushedAt: new Date(Date.now() - 6 * 86_400_000).toISOString() })),
    syncedAt: new Date(),
  };
  await db.insert(githubProfiles).values({ userId: uid, ...snapshot }).onConflictDoUpdate({ target: githubProfiles.userId, set: snapshot });

  const learner = { ...demo.learner, updatedAt: new Date() };
  await db.insert(learningProfiles).values({ userId: uid, ...learner }).onConflictDoUpdate({ target: learningProfiles.userId, set: learner });

  // Rebuild the path from the current catalogue, with a bit of progress so it looks lived-in.
  await db.delete(learningPaths).where(eq(learningPaths.userId, uid));
  const generated = generatePath(demo.learner, catalog);
  if (generated.stages.length === 0) {
    console.log(`• ${demo.handle}: profile created, no path yet (the catalogue is empty; run the app once to fill it, then seed again).`);
    return;
  }
  const [path] = await db
    .insert(learningPaths)
    .values({
      userId: uid, title: generated.title, goal: demo.learner.goal, level: demo.learner.level, hoursPerWeek: demo.learner.hoursPerWeek,
      totalMinutes: generated.totalMinutes, stages: generated.stages.map((s) => ({ index: s.index, title: s.title, objective: s.objective, minutes: s.minutes })),
    })
    .returning();
  const steps = generated.stages.flatMap((s) => s.steps.map((step) => ({ stage: s.index, ...step })));
  const doneCount = Math.min(Math.ceil(steps.length / 4), steps.length);
  await db.insert(learningSteps).values(
    steps.map((step, position) => ({
      pathId: path!.id, userId: uid, contentId: step.contentId, stage: step.stage, position, kind: step.kind, minutes: step.minutes,
      status: position < doneCount ? 'done' : position === doneCount ? 'doing' : 'todo',
      startedAt: position <= doneCount ? new Date() : null,
      completedAt: position < doneCount ? new Date() : null,
    })),
  );
  console.log(`• ${demo.handle}: public profile, ${steps.length}-step path (${demo.pathPublic ? 'public' : 'private'}).`);
}

async function main() {
  await seedAdmin();
  const catalog = await loadCatalog();
  for (const demo of DEMOS) await seedDemo(demo, catalog);
  console.log('Seed done.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
