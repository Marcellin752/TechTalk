import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '../../db/db.js';
import { contents, learningPaths, learningProfiles, learningSteps, schools, type PathSettings, type ProgrammeYear } from '../../db/schema.js';
import { generatePath, generateSchoolPath, type CatalogItem, type GeneratedPath, type LearnerProfile } from './generator.js';
import { assemblePathView, type PathRow, type StepRow } from './view.js';
import { MIN_COHORT } from '../schools.js';

/* Everything that reads or writes a learner's paths. A learner can have several: one for
   school, a personal one and others of their choice. One is the "main" path (`active`):
   the one the home page, the calendar planner and Kairos follow by default. */

export const MAX_PATHS = 6;
export type PathKind = 'personal' | 'school' | 'custom';
const SLOT_TYPES = ['roadmap', 'course', 'video', 'doc', 'exercise', 'repo', 'paper', 'question', 'opportunity'];

export class PathError extends Error {
  constructor(public code: 'empty_path' | 'no_school' | 'no_programme' | 'limit' | 'exists' | 'not_found', message: string) {
    super(message);
  }
}

export async function loadCatalog(): Promise<CatalogItem[]> {
  const items = (await db
    .select({ id: contents.id, type: contents.type, title: contents.title, summary: contents.summary, source: contents.source, categories: contents.categories, meta: contents.meta })
    .from(contents)
    .where(and(inArray(contents.type, SLOT_TYPES), sql`(${contents.type} <> 'video' or ${contents.meta}->>'learn' = 'true')`))) as CatalogItem[];

  // How learners who agreed to share fared with each resource. Only resources that at least
  // MIN_COHORT of them started carry a signal, so no single learner can be picked out.
  const rows = Array.from(
    (await db.execute(sql`
      select ls.content_id as id,
             count(distinct ls.user_id) filter (where ls.status = 'done')::int as done,
             count(distinct ls.user_id) filter (where ls.status <> 'todo')::int as started
      from learning_steps ls
      join learning_profiles lp on lp.user_id = ls.user_id and lp.share_for_recommendations
      group by ls.content_id
      having count(distinct ls.user_id) filter (where ls.status <> 'todo') >= ${MIN_COHORT}
    `)) as unknown as { id: string; done: number; started: number }[],
  );
  const signals = new Map(rows.map((r) => [r.id, { done: r.done, started: r.started }]));
  return items.map((i) => ({ ...i, signal: signals.get(i.id) ?? null }));
}

/** The full view of one of the learner's paths, or null. */
export async function pathView(uid: string, pathId: string) {
  const [path] = await db.select().from(learningPaths).where(and(eq(learningPaths.id, pathId), eq(learningPaths.userId, uid))).limit(1);
  if (!path) return null;
  const rows = await db
    .select({
      id: learningSteps.id, position: learningSteps.position, stage: learningSteps.stage, kind: learningSteps.kind,
      minutes: learningSteps.minutes, status: learningSteps.status, completedAt: learningSteps.completedAt,
      content: { id: contents.id, type: contents.type, title: contents.title, url: contents.url, source: contents.source, summary: contents.summary, image: contents.image, meta: contents.meta },
    })
    .from(learningSteps)
    .innerJoin(contents, eq(contents.id, learningSteps.contentId))
    .where(eq(learningSteps.pathId, path.id))
    .orderBy(asc(learningSteps.position));
  return assemblePathView(path as PathRow, rows as StepRow[]);
}

export async function primaryPathId(uid: string): Promise<string | null> {
  const [p] = await db.select({ id: learningPaths.id }).from(learningPaths).where(and(eq(learningPaths.userId, uid), eq(learningPaths.active, true))).limit(1);
  return p?.id ?? null;
}

export async function primaryPathView(uid: string) {
  const id = await primaryPathId(uid);
  return id ? pathView(uid, id) : null;
}

/** One line per path, for the switcher: what it is and how far along. */
export async function listPaths(uid: string) {
  const paths = await db.select().from(learningPaths).where(eq(learningPaths.userId, uid)).orderBy(asc(learningPaths.createdAt));
  if (paths.length === 0) return [];
  const sums = await db
    .select({
      pathId: learningSteps.pathId,
      total: sql<number>`count(*)::int`,
      done: sql<number>`count(*) filter (where ${learningSteps.status} = 'done')::int`,
      minutes: sql<number>`coalesce(sum(${learningSteps.minutes}), 0)::int`,
      minutesDone: sql<number>`coalesce(sum(${learningSteps.minutes}) filter (where ${learningSteps.status} = 'done'), 0)::int`,
    })
    .from(learningSteps)
    .where(inArray(learningSteps.pathId, paths.map((p) => p.id)))
    .groupBy(learningSteps.pathId);
  return paths.map((p) => {
    const s = sums.find((x) => x.pathId === p.id);
    return {
      id: p.id, kind: p.kind, title: p.title, active: p.active, goal: p.goal, level: p.level, schoolYear: p.settings?.schoolYear ?? null, createdAt: p.createdAt,
      progress: { doneSteps: s?.done ?? 0, totalSteps: s?.total ?? 0, percent: s && s.minutes ? Math.round((s.minutesDone / s.minutes) * 100) : 0 },
    };
  });
}

/** What the learner's school offers for a year: the programme, or the topics they typed. */
async function schoolYearFor(uid: string, year: number | null | undefined): Promise<{ schoolName: string; year: ProgrammeYear; draft: boolean }> {
  const [lp] = await db
    .select({ school: learningProfiles.school, schoolId: learningProfiles.schoolId, schoolYear: learningProfiles.schoolYear, topics: learningProfiles.schoolTopics })
    .from(learningProfiles)
    .where(eq(learningProfiles.userId, uid))
    .limit(1);
  if (!lp?.school) throw new PathError('no_school', 'Add your school first.');
  const wanted = year ?? lp.schoolYear ?? 1;

  if (lp.schoolId) {
    const [sc] = await db.select({ curriculum: schools.curriculum, name: schools.name }).from(schools).where(eq(schools.id, lp.schoolId)).limit(1);
    const found = sc?.curriculum.programme?.years.find((y) => y.year === wanted);
    if (found) return { schoolName: sc!.name, year: found, draft: sc!.curriculum.programme?.status !== 'confirmed' };
  }
  // No programme: build one from the topics the learner gave, a project per topic.
  const topics = lp.topics ?? [];
  if (topics.length === 0) throw new PathError('no_programme', 'This school has no programme for that year yet, and no topics were given.');
  return {
    schoolName: lp.school,
    draft: false,
    year: { year: wanted, title: `${lp.school}, year ${wanted}`, projects: topics.map((t) => ({ name: `Reinforce: ${t}`, topics: [t], hours: 15, summary: `Go deeper on ${t}.` })) },
  };
}

export interface BuildOptions {
  /** Rebuild this path in place (keeping what is done); otherwise a new one is created. */
  pathId?: string;
  kind: PathKind;
  title?: string;
  settings: PathSettings;
  makePrimary?: boolean;
}

/** Generates a path and stores it. Returns its id. */
export async function buildPath(uid: string, o: BuildOptions): Promise<string> {
  const catalog = await loadCatalog();
  const learner: LearnerProfile = {
    goal: o.settings.goal as LearnerProfile['goal'], level: o.settings.level as LearnerProfile['level'], languages: o.settings.languages,
    hoursPerWeek: o.settings.hoursPerWeek, style: o.settings.style as LearnerProfile['style'],
  };

  let generated: GeneratedPath;
  let settings = o.settings;
  if (o.kind === 'school') {
    const { schoolName, year, draft } = await schoolYearFor(uid, o.settings.schoolYear);
    generated = generateSchoolPath(learner, schoolName, year, catalog);
    settings = { ...o.settings, schoolYear: year.year, programmeDraft: draft };
  } else {
    generated = generatePath(learner, catalog);
  }
  if (generated.stages.length === 0) throw new PathError('empty_path', 'The catalogue has no content for this yet. Try again later.');

  const stages = generated.stages.map((s) => ({ index: s.index, title: s.title, objective: s.objective, minutes: s.minutes, ...(s.topics ? { topics: s.topics } : {}), ...(s.kind ? { kind: s.kind } : {}) }));

  return db.transaction(async (tx) => {
    let pathId = o.pathId;
    let doneBefore = new Set<string>();
    if (pathId) {
      const [existing] = await tx.select({ id: learningPaths.id }).from(learningPaths).where(and(eq(learningPaths.id, pathId), eq(learningPaths.userId, uid))).limit(1);
      if (!existing) throw new PathError('not_found', 'Path not found.');
      doneBefore = new Set((await tx.select({ c: learningSteps.contentId }).from(learningSteps).where(and(eq(learningSteps.pathId, pathId), eq(learningSteps.status, 'done')))).map((r) => r.c));
      await tx.delete(learningSteps).where(eq(learningSteps.pathId, pathId));
      // The title is kept: it may have been renamed.
      await tx.update(learningPaths).set({ goal: o.settings.goal, level: o.settings.level, hoursPerWeek: o.settings.hoursPerWeek, totalMinutes: generated.totalMinutes, stages, settings }).where(eq(learningPaths.id, pathId));
    } else {
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(learningPaths).where(eq(learningPaths.userId, uid));
      if (n >= MAX_PATHS) throw new PathError('limit', `You can have ${MAX_PATHS} paths at most. Delete one first.`);
      const hasPrimary = n > 0 && (await tx.select({ id: learningPaths.id }).from(learningPaths).where(and(eq(learningPaths.userId, uid), eq(learningPaths.active, true))).limit(1)).length > 0;
      const primary = o.makePrimary ?? !hasPrimary;
      if (primary) await tx.update(learningPaths).set({ active: false }).where(eq(learningPaths.userId, uid));
      const [row] = await tx
        .insert(learningPaths)
        .values({ userId: uid, title: o.title ?? generated.title, goal: o.settings.goal, level: o.settings.level, hoursPerWeek: o.settings.hoursPerWeek, totalMinutes: generated.totalMinutes, stages, active: primary, kind: o.kind, settings })
        .returning({ id: learningPaths.id });
      pathId = row!.id;
    }

    const stepRows = generated.stages.flatMap((s) => s.steps.map((step) => ({ stage: s.index, ...step })));
    await tx.insert(learningSteps).values(
      stepRows.map((step, position) => ({
        pathId: pathId!, userId: uid, contentId: step.contentId, stage: step.stage, position, kind: step.kind, minutes: step.minutes,
        status: doneBefore.has(step.contentId) ? 'done' : 'todo',
        completedAt: doneBefore.has(step.contentId) ? new Date() : null,
      })),
    );
    return pathId!;
  });
}

/** The settings a path starts from: the learner's profile, with what the caller overrides. */
export function settingsFrom(profile: { goal: string; level: string; languages: string[]; hoursPerWeek: number; style: string }, over: Partial<PathSettings> = {}): PathSettings {
  return { goal: profile.goal, level: profile.level, languages: profile.languages, hoursPerWeek: profile.hoursPerWeek, style: profile.style, ...over };
}

export async function deletePath(uid: string, pathId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [p] = await tx.select({ id: learningPaths.id, active: learningPaths.active }).from(learningPaths).where(and(eq(learningPaths.id, pathId), eq(learningPaths.userId, uid))).limit(1);
    if (!p) return false;
    await tx.delete(learningPaths).where(eq(learningPaths.id, pathId));
    if (p.active) {
      // Another path takes over as the main one, the most recently made first.
      const [next] = await tx.select({ id: learningPaths.id }).from(learningPaths).where(and(eq(learningPaths.userId, uid), ne(learningPaths.id, pathId))).orderBy(sql`${learningPaths.createdAt} desc`).limit(1);
      if (next) await tx.update(learningPaths).set({ active: true }).where(eq(learningPaths.id, next.id));
    }
    return true;
  });
}

export async function makePrimary(uid: string, pathId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [p] = await tx.select({ id: learningPaths.id }).from(learningPaths).where(and(eq(learningPaths.id, pathId), eq(learningPaths.userId, uid))).limit(1);
    if (!p) return false;
    await tx.update(learningPaths).set({ active: false }).where(eq(learningPaths.userId, uid));
    await tx.update(learningPaths).set({ active: true }).where(eq(learningPaths.id, pathId));
    return true;
  });
}
