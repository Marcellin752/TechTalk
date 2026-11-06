import { FastifyRequest, FastifyReply } from 'fastify';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { contents, learningPaths, learningProfiles, learningSteps } from '../db/schema.js';
import { generatePath, type CatalogItem, type LearnerProfile } from '../services/learning/generator.js';
import { assemblePathView, type PathRow, type StepRow } from '../services/learning/view.js';
import { GOALS, LANGUAGES, LEVELS, STYLES, type Goal, type Level, type Style } from '../services/learning/templates.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLOT_TYPES = ['roadmap', 'course', 'video', 'doc', 'exercise', 'repo', 'paper', 'question', 'opportunity'];

const userId = (r: FastifyRequest) => (r.user as { id: string }).id;

/** Validates what the learner chose; returns the clean profile or a message for the first problem. */
export function parseProfile(body: unknown): { ok: true; profile: LearnerProfile } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!GOALS.includes(b.goal as Goal)) return { ok: false, error: 'Choose what you want to learn.' };
  if (!LEVELS.includes(b.level as Level)) return { ok: false, error: 'Choose your current level.' };
  if (!STYLES.includes(b.style as Style)) return { ok: false, error: 'Choose how you like to learn.' };
  const hours = Number(b.hoursPerWeek);
  if (!Number.isInteger(hours) || hours < 1 || hours > 40) return { ok: false, error: 'Hours per week must be between 1 and 40.' };
  const languages = Array.isArray(b.languages) ? (b.languages as unknown[]) : [];
  if (languages.length > 5 || languages.some((l) => !LANGUAGES.includes(l as (typeof LANGUAGES)[number]))) {
    return { ok: false, error: 'Pick up to 5 of the listed languages.' };
  }
  return { ok: true, profile: { goal: b.goal as Goal, level: b.level as Level, style: b.style as Style, hoursPerWeek: hours, languages: [...new Set(languages as string[])] } };
}

async function loadCatalog(): Promise<CatalogItem[]> {
  return (await db
    .select({ id: contents.id, type: contents.type, title: contents.title, summary: contents.summary, source: contents.source, categories: contents.categories, meta: contents.meta })
    .from(contents)
    .where(and(inArray(contents.type, SLOT_TYPES), sql`(${contents.type} <> 'video' or ${contents.meta}->>'learn' = 'true')`))) as CatalogItem[];
}

async function activePathView(uid: string) {
  const [path] = await db.select().from(learningPaths).where(and(eq(learningPaths.userId, uid), eq(learningPaths.active, true))).limit(1);
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

/** Builds a path for the profile and makes it the active one, keeping what was already done. */
async function createPath(uid: string, profile: LearnerProfile) {
  const generated = generatePath(profile, await loadCatalog());
  if (generated.stages.length === 0) throw new Error('empty_path');

  const previous = await db.select({ id: learningPaths.id }).from(learningPaths).where(and(eq(learningPaths.userId, uid), eq(learningPaths.active, true)));
  const doneBefore = previous.length
    ? new Set(
        (await db
          .select({ contentId: learningSteps.contentId })
          .from(learningSteps)
          .where(and(eq(learningSteps.userId, uid), eq(learningSteps.status, 'done'), inArray(learningSteps.pathId, previous.map((p) => p.id))))).map((r) => r.contentId),
      )
    : new Set<string>();

  await db.update(learningPaths).set({ active: false }).where(and(eq(learningPaths.userId, uid), eq(learningPaths.active, true)));
  const [path] = await db
    .insert(learningPaths)
    .values({
      userId: uid, title: generated.title, goal: profile.goal, level: profile.level, hoursPerWeek: profile.hoursPerWeek, totalMinutes: generated.totalMinutes,
      stages: generated.stages.map((s) => ({ index: s.index, title: s.title, objective: s.objective, minutes: s.minutes })),
    })
    .returning();

  const stepRows = generated.stages.flatMap((s) => s.steps.map((step) => ({ stage: s.index, ...step })));
  await db.insert(learningSteps).values(
    stepRows.map((step, position) => ({
      pathId: path!.id, userId: uid, contentId: step.contentId, stage: step.stage, position, kind: step.kind, minutes: step.minutes,
      status: doneBefore.has(step.contentId) ? 'done' : 'todo',
      completedAt: doneBefore.has(step.contentId) ? new Date() : null,
    })),
  );
  return activePathView(uid);
}

export async function handleGetLearningProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const [profile] = await db.select().from(learningProfiles).where(eq(learningProfiles.userId, userId(request))).limit(1);
    return reply.status(200).send({ profile: profile ?? null });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/** Saves the learner's choices and builds their path from them. */
export async function handleSaveLearningProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = parseProfile(request.body);
    if (!parsed.ok) return reply.status(400).send({ error: parsed.error });
    const uid = userId(request);
    const p = parsed.profile;

    await db
      .insert(learningProfiles)
      .values({ userId: uid, goal: p.goal, level: p.level, languages: p.languages, hoursPerWeek: p.hoursPerWeek, style: p.style })
      .onConflictDoUpdate({ target: learningProfiles.userId, set: { goal: p.goal, level: p.level, languages: p.languages, hoursPerWeek: p.hoursPerWeek, style: p.style, updatedAt: new Date() } });

    try {
      return reply.status(200).send({ profile: p, path: await createPath(uid, p) });
    } catch (err) {
      if ((err as Error).message === 'empty_path') return reply.status(503).send({ error: 'The catalogue has no content for this goal yet. Try again later.' });
      throw err;
    }
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleGetPath(request: FastifyRequest, reply: FastifyReply) {
  try {
    return reply.status(200).send({ path: await activePathView(userId(request)) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleRegeneratePath(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const [profile] = await db.select().from(learningProfiles).where(eq(learningProfiles.userId, uid)).limit(1);
    if (!profile) return reply.status(409).send({ error: 'Set your learning preferences first.' });
    const path = await createPath(uid, profile as LearnerProfile);
    return reply.status(200).send({ path });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleUpdateStep(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { stepId } = request.params as { stepId?: string };
    const status = ((request.body ?? {}) as { status?: string }).status;
    if (!stepId || !UUID_RE.test(stepId)) return reply.status(400).send({ error: 'Invalid step id.' });
    if (status !== 'todo' && status !== 'doing' && status !== 'done') return reply.status(400).send({ error: 'Status must be todo, doing or done.' });

    const [step] = await db.select().from(learningSteps).where(and(eq(learningSteps.id, stepId), eq(learningSteps.userId, userId(request)))).limit(1);
    if (!step) return reply.status(404).send({ error: 'Step not found.' });

    await db
      .update(learningSteps)
      .set({
        status,
        startedAt: status === 'todo' ? null : step.startedAt ?? new Date(),
        completedAt: status === 'done' ? new Date() : null,
      })
      .where(eq(learningSteps.id, stepId));
    return reply.status(200).send({ path: await activePathView(userId(request)) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}
