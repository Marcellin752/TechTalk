import { FastifyRequest, FastifyReply } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { learningPaths, learningProfiles, learningSteps, schools } from '../db/schema.js';
import type { LearnerProfile } from '../services/learning/generator.js';
import { buildPath, deletePath, listPaths, makePrimary, MAX_PATHS, pathView, PathError, primaryPathId, primaryPathView, settingsFrom, type PathKind } from '../services/learning/paths-store.js';
import { cleanTopics, schoolPresetsView } from '../services/learning/school.js';
import { GOALS, LANGUAGES, LEVELS, STYLES, type Goal, type Level, type Style } from '../services/learning/templates.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const base = { goal: b.goal as Goal, level: b.level as Level, style: b.style as Style, hoursPerWeek: hours, languages: [...new Set(languages as string[])] };
  // Without a "school" key the caller is not talking about school (the onboarding wizard
  // does not): leave what is stored alone.
  if (!('school' in b)) return { ok: true, profile: base };
  const school = typeof b.school === 'string' && b.school.trim() ? b.school.trim().slice(0, 80) : null;
  const year = b.schoolYear == null || b.schoolYear === '' ? null : Number(b.schoolYear);
  if (year !== null && (!Number.isInteger(year) || year < 1 || year > 8)) return { ok: false, error: 'School year must be between 1 and 8.' };
  return { ok: true, profile: { ...base, school, schoolYear: school ? year : null, schoolTopics: school ? cleanTopics(b.schoolTopics) : [] } };
}

/** Maps what the path engine refuses to the right HTTP answer. */
function sendPathError(reply: FastifyReply, err: unknown) {
  if (err instanceof PathError) {
    const status = err.code === 'empty_path' ? 503 : err.code === 'not_found' ? 404 : 409;
    return reply.status(status).send({ error: err.message, code: err.code });
  }
  throw err;
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
    const [existing] = await db.select().from(learningProfiles).where(eq(learningProfiles.userId, uid)).limit(1);
    const given = parsed.profile;
    // What the caller did not mention (the school) stays as it was.
    const p: LearnerProfile = {
      ...given,
      school: given.school !== undefined ? given.school : existing?.school ?? null,
      schoolYear: given.schoolYear !== undefined ? given.schoolYear : existing?.schoolYear ?? null,
      schoolTopics: given.schoolTopics !== undefined ? given.schoolTopics : existing?.schoolTopics ?? [],
    };
    const row = { goal: p.goal, level: p.level, languages: p.languages, hoursPerWeek: p.hoursPerWeek, style: p.style, school: p.school ?? null, schoolYear: p.schoolYear ?? null, schoolTopics: p.schoolTopics ?? [] };

    await db
      .insert(learningProfiles)
      .values({ userId: uid, ...row })
      .onConflictDoUpdate({ target: learningProfiles.userId, set: { ...row, updatedAt: new Date() } });

    // The wizard's path is the personal one: rebuilt if it exists, otherwise made.
    try {
      const [personal] = await db.select({ id: learningPaths.id }).from(learningPaths).where(and(eq(learningPaths.userId, uid), eq(learningPaths.kind, 'personal'))).limit(1);
      const id = await buildPath(uid, { pathId: personal?.id, kind: 'personal', settings: settingsFrom(row) });
      return reply.status(200).send({ profile: p, path: await pathView(uid, id) });
    } catch (err) {
      return sendPathError(reply, err);
    }
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleGetPath(request: FastifyRequest, reply: FastifyReply) {
  try {
    return reply.status(200).send({ path: await primaryPathView(userId(request)) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleRegeneratePath(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const id = await primaryPathId(uid);
    if (!id) {
      const [profile] = await db.select().from(learningProfiles).where(eq(learningProfiles.userId, uid)).limit(1);
      if (!profile) return reply.status(409).send({ error: 'Set your learning preferences first.' });
      return reply.status(200).send({ path: await pathView(uid, await buildPath(uid, { kind: 'personal', settings: settingsFrom(profile) })) });
    }
    return rebuild(request, reply, id);
  } catch (error) {
    return sendPathError(reply, error);
  }
}

/** Rebuilds one path from its own settings (the personal path follows the current profile). */
async function rebuild(request: FastifyRequest, reply: FastifyReply, pathId: string) {
  const uid = userId(request);
  const [path] = await db.select().from(learningPaths).where(and(eq(learningPaths.id, pathId), eq(learningPaths.userId, uid))).limit(1);
  if (!path) return reply.status(404).send({ error: 'Path not found.' });
  const [profile] = await db.select().from(learningProfiles).where(eq(learningProfiles.userId, uid)).limit(1);
  const base = path.settings ?? (profile ? settingsFrom(profile) : { goal: path.goal, level: path.level, languages: [], hoursPerWeek: path.hoursPerWeek, style: 'mixed' });
  const settings = path.kind === 'personal' && profile ? settingsFrom(profile) : base;
  await buildPath(uid, { pathId, kind: path.kind as PathKind, settings });
  return reply.status(200).send({ path: await pathView(uid, pathId) });
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
    return reply.status(200).send({ path: await pathView(userId(request), step.pathId) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/** The schools we can pre-fill: those that joined, then the built-in presets that have not. */
export async function handleListSchools(_request: FastifyRequest, reply: FastifyReply) {
  try {
    const joined = await db.select({ slug: schools.slug, name: schools.name, curriculum: schools.curriculum }).from(schools).where(eq(schools.active, true));
    const list = joined.map((s) => ({ id: s.slug, name: s.name, years: s.curriculum.years, partner: true }));
    for (const preset of schoolPresetsView()) if (!list.some((s) => s.id === preset.id)) list.push({ ...preset, partner: false });
    return reply.status(200).send({ schools: list });
  } catch (error) {
    _request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/** Finds the joined school a learner typed (or picked) by name. */
async function findSchoolId(name: string | null): Promise<string | null> {
  if (!name) return null;
  const [row] = await db.select({ id: schools.id }).from(schools).where(and(eq(schools.active, true), sql`lower(${schools.name}) = ${name.toLowerCase()}`)).limit(1);
  return row?.id ?? null;
}

/** Consent switches. They are the learner's alone and can be taken back at any time. */
export async function handleSetConsent(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const b = (request.body ?? {}) as { shareWithSchool?: unknown; shareForRecommendations?: unknown };
    const set: Record<string, boolean> = {};
    for (const key of ['shareWithSchool', 'shareForRecommendations'] as const) {
      if (b[key] === undefined) continue;
      if (typeof b[key] !== 'boolean') return reply.status(400).send({ error: `${key} must be true or false.` });
      set[key] = b[key] as boolean;
    }
    if (Object.keys(set).length === 0) return reply.status(400).send({ error: 'Nothing to change.' });
    const updated = await db.update(learningProfiles).set(set).where(eq(learningProfiles.userId, uid)).returning();
    if (updated.length === 0) return reply.status(409).send({ error: 'Set your learning preferences first.' });
    return reply.status(200).send({ profile: updated[0] });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/**
 * "Improve my path from my school": saves where the learner studies and what they
 * are covering, then rebuilds the path around it. Finished steps are kept.
 */
export async function handleSetSchool(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const [profile] = await db.select().from(learningProfiles).where(eq(learningProfiles.userId, uid)).limit(1);
    if (!profile) return reply.status(409).send({ error: 'Set your learning preferences first.' });

    const b = (request.body ?? {}) as Record<string, unknown>;
    const school = typeof b.school === 'string' && b.school.trim() ? b.school.trim().slice(0, 80) : null;
    const year = b.schoolYear == null || b.schoolYear === '' ? null : Number(b.schoolYear);
    if (year !== null && (!Number.isInteger(year) || year < 1 || year > 8)) return reply.status(400).send({ error: 'School year must be between 1 and 8.' });
    const topics = school ? cleanTopics(b.schoolTopics) : [];
    if (school && topics.length === 0) return reply.status(400).send({ error: 'Add at least one topic you study at school.' });

    const consent: Record<string, boolean> = {};
    if (typeof b.shareWithSchool === 'boolean') consent.shareWithSchool = school ? b.shareWithSchool : false;
    if (typeof b.shareForRecommendations === 'boolean') consent.shareForRecommendations = b.shareForRecommendations;
    // Leaving a school ends the sharing with it.
    if (!school) consent.shareWithSchool = false;

    await db
      .update(learningProfiles)
      .set({ school, schoolId: await findSchoolId(school), schoolYear: school ? year : null, schoolTopics: topics, ...consent, updatedAt: new Date() })
      .where(eq(learningProfiles.userId, uid));

    // The school path follows the school: made for this year, or rebuilt if it exists.
    const [saved] = await db.select().from(learningProfiles).where(eq(learningProfiles.userId, uid)).limit(1);
    let schoolPath = null;
    if (school) {
      try {
        const wanted = year ?? 1;
        const existing = (await db.select().from(learningPaths).where(and(eq(learningPaths.userId, uid), eq(learningPaths.kind, 'school')))).find((p) => (p.settings?.schoolYear ?? 1) === wanted);
        const id = await buildPath(uid, { pathId: existing?.id, kind: 'school', settings: settingsFrom(saved!, { schoolYear: wanted }) });
        schoolPath = await pathView(uid, id);
      } catch (err) {
        // The school is saved even if its path cannot be built right now.
        if (!(err instanceof PathError)) throw err;
        request.log.warn({ code: err.code }, 'school_path_not_built');
      }
    }
    return reply.status(200).send({ profile: saved, path: schoolPath, paths: await listPaths(uid) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/* ------------------------------ several paths ------------------------------ */

export async function handleListPaths(request: FastifyRequest, reply: FastifyReply) {
  try {
    return reply.status(200).send({ paths: await listPaths(userId(request)), max: MAX_PATHS });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleGetPathById(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid path id.' });
    const view = await pathView(userId(request), id);
    if (!view) return reply.status(404).send({ error: 'Path not found.' });
    return reply.status(200).send({ path: view });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/** Makes another path: for school (a year of the programme), personal, or a custom one. */
export async function handleCreatePath(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const b = (request.body ?? {}) as Record<string, unknown>;
    const kind = b.kind as PathKind;
    if (kind !== 'personal' && kind !== 'school' && kind !== 'custom') return reply.status(400).send({ error: 'kind must be personal, school or custom.' });
    const [profile] = await db.select().from(learningProfiles).where(eq(learningProfiles.userId, uid)).limit(1);
    const existing = await db.select().from(learningPaths).where(eq(learningPaths.userId, uid));

    let title: string | undefined;
    if (b.title !== undefined) {
      title = typeof b.title === 'string' ? b.title.replace(/\s+/g, ' ').trim() : '';
      if (title.length < 2 || title.length > 80) return reply.status(400).send({ error: 'The name must be 2 to 80 characters.' });
    }
    if (kind === 'custom' && !title) return reply.status(400).send({ error: 'Give your path a name.' });

    if (kind === 'personal') {
      if (existing.some((p) => p.kind === 'personal')) return reply.status(409).send({ error: 'You already have a personal path: rebuild it instead.', code: 'exists' });
      if (!profile) return reply.status(409).send({ error: 'Set your learning preferences first.' });
      return reply.status(201).send({ path: await pathView(uid, await buildPath(uid, { kind, title, settings: settingsFrom(profile) })) });
    }

    // school and custom paths can take their own goal, level, time and style; the rest comes from the profile.
    const merged = parseProfile({ goal: b.goal ?? profile?.goal, level: b.level ?? profile?.level, style: b.style ?? profile?.style, hoursPerWeek: b.hoursPerWeek ?? profile?.hoursPerWeek, languages: b.languages ?? profile?.languages ?? [] });
    if (!merged.ok) return reply.status(400).send({ error: merged.error });
    const base = settingsFrom(merged.profile);

    if (kind === 'school') {
      const year = b.schoolYear == null ? profile?.schoolYear ?? 1 : Number(b.schoolYear);
      if (!Number.isInteger(year) || year < 1 || year > 8) return reply.status(400).send({ error: 'School year must be between 1 and 8.' });
      if (existing.some((p) => p.kind === 'school' && (p.settings?.schoolYear ?? 1) === year)) return reply.status(409).send({ error: `You already have a path for year ${year}.`, code: 'exists' });
      return reply.status(201).send({ path: await pathView(uid, await buildPath(uid, { kind, title, settings: { ...base, schoolYear: year } })) });
    }
    return reply.status(201).send({ path: await pathView(uid, await buildPath(uid, { kind, title, settings: base })) });
  } catch (error) {
    return sendPathError(reply, error);
  }
}

export async function handleRebuildPath(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid path id.' });
    return await rebuild(request, reply, id);
  } catch (error) {
    return sendPathError(reply, error);
  }
}

/** Rename a path, or make it the main one. */
export async function handleUpdatePath(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { id } = request.params as { id?: string };
    const b = (request.body ?? {}) as { title?: unknown; active?: unknown };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid path id.' });
    if (b.title === undefined && b.active === undefined) return reply.status(400).send({ error: 'Nothing to change.' });
    if (b.title !== undefined) {
      const title = typeof b.title === 'string' ? b.title.replace(/\s+/g, ' ').trim() : '';
      if (title.length < 2 || title.length > 80) return reply.status(400).send({ error: 'The name must be 2 to 80 characters.' });
      const done = await db.update(learningPaths).set({ title }).where(and(eq(learningPaths.id, id), eq(learningPaths.userId, uid))).returning({ id: learningPaths.id });
      if (done.length === 0) return reply.status(404).send({ error: 'Path not found.' });
    }
    if (b.active === true && !(await makePrimary(uid, id))) return reply.status(404).send({ error: 'Path not found.' });
    if (b.active === false) return reply.status(400).send({ error: 'Pick another path as the main one instead.' });
    return reply.status(200).send({ paths: await listPaths(uid) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleDeletePath(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid path id.' });
    if (!(await deletePath(userId(request), id))) return reply.status(404).send({ error: 'Path not found.' });
    return reply.status(200).send({ paths: await listPaths(userId(request)) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}
