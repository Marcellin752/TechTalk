import { FastifyRequest, FastifyReply } from 'fastify';
import { and, asc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { campusResources, schoolEvents, schools } from '../db/schema.js';
import { parseResource, type ResourceInput } from '../services/campus.js';
import { aggregateCohort, extractApiKey, hashApiKey, MIN_COHORT, parseCurriculum, parseSchoolEvent, type LearnerRow, type SchoolEventInput } from '../services/schools.js';

type School = typeof schools.$inferSelect;
const schoolOf = (r: FastifyRequest) => (r as unknown as { school: School }).school;
const MAX_BATCH = 200;
const MAX_EVENTS_PER_SCHOOL = 5000;

/** Authenticates a school by its API key (X-API-Key, or Authorization: Bearer ttk_...). */
export async function requireSchoolKey(request: FastifyRequest, reply: FastifyReply) {
  const key = extractApiKey(request.headers as Record<string, unknown>);
  if (!key) return reply.status(401).send({ error: 'Unauthorized', message: 'Send your API key in the X-API-Key header.' });
  const [school] = await db.select().from(schools).where(eq(schools.apiKeyHash, hashApiKey(key))).limit(1);
  if (!school || !school.active) return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or disabled API key.' });
  (request as unknown as { school: School }).school = school;
  // Record use, but at most once a minute per school.
  if (!school.lastUsedAt || Date.now() - school.lastUsedAt.getTime() > 60_000) {
    void db.update(schools).set({ lastUsedAt: new Date() }).where(eq(schools.id, school.id)).catch(() => undefined);
  }
}

const fail = (request: FastifyRequest, reply: FastifyReply, error: unknown) => {
  request.log.error(error);
  return reply.status(500).send({ error: 'Internal server error.' });
};

export async function handlePartnerMe(request: FastifyRequest, reply: FastifyReply) {
  const s = schoolOf(request);
  return reply.status(200).send({ id: s.id, slug: s.slug, name: s.name, curriculum: s.curriculum, keyPrefix: s.apiKeyPrefix, minimumGroupSize: MIN_COHORT });
}

export async function handlePutCurriculum(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = parseCurriculum(request.body);
    if (!parsed.ok) return reply.status(400).send({ error: parsed.error });
    await db.update(schools).set({ curriculum: parsed.curriculum }).where(eq(schools.id, schoolOf(request).id));
    return reply.status(200).send({ curriculum: parsed.curriculum });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** Adds or updates events in bulk. Pushing the same externalId again updates it. */
export async function handlePutEvents(request: FastifyRequest, reply: FastifyReply) {
  try {
    const list = ((request.body ?? {}) as { events?: unknown }).events;
    if (!Array.isArray(list) || list.length === 0) return reply.status(400).send({ error: 'Send { "events": [ ... ] } with at least one event.' });
    if (list.length > MAX_BATCH) return reply.status(400).send({ error: `At most ${MAX_BATCH} events per request.` });
    const parsed = list.map(parseSchoolEvent);
    const bad = parsed.findIndex((p) => !p.ok);
    if (bad !== -1) return reply.status(400).send({ error: `events[${bad}]: ${(parsed[bad] as { error: string }).error}` });

    const school = schoolOf(request);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schoolEvents).where(eq(schoolEvents.schoolId, school.id));
    if (n + list.length > MAX_EVENTS_PER_SCHOOL) return reply.status(409).send({ error: 'Too many events stored. Delete old ones first.' });

    for (const p of parsed) {
      const e = (p as { ok: true; event: SchoolEventInput }).event;
      await db
        .insert(schoolEvents)
        .values({ schoolId: school.id, ...e })
        .onConflictDoUpdate({
          target: [schoolEvents.schoolId, schoolEvents.externalId],
          set: { title: e.title, kind: e.kind, startsAt: e.startsAt, endsAt: e.endsAt, notes: e.notes, year: e.year },
        });
    }
    return reply.status(200).send({ upserted: parsed.length });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleListPartnerEvents(request: FastifyRequest, reply: FastifyReply) {
  try {
    const rows = await db
      .select({ externalId: schoolEvents.externalId, title: schoolEvents.title, kind: schoolEvents.kind, startsAt: schoolEvents.startsAt, endsAt: schoolEvents.endsAt, notes: schoolEvents.notes, year: schoolEvents.year })
      .from(schoolEvents)
      .where(and(eq(schoolEvents.schoolId, schoolOf(request).id), gte(schoolEvents.endsAt, new Date())))
      .orderBy(asc(schoolEvents.startsAt))
      .limit(500);
    return reply.status(200).send({ events: rows });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleDeletePartnerEvent(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { externalId } = request.params as { externalId?: string };
    const deleted = await db
      .delete(schoolEvents)
      .where(and(eq(schoolEvents.schoolId, schoolOf(request).id), eq(schoolEvents.externalId, String(externalId))))
      .returning({ id: schoolEvents.id });
    if (deleted.length === 0) return reply.status(404).send({ error: 'Event not found.' });
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** Anonymous statistics about the learners of this school who agreed to share. */
export async function handleStats(request: FastifyRequest, reply: FastifyReply) {
  try {
    const id = schoolOf(request).id;
    const rows = Array.from(
      (await db.execute(sql`
        select lp.school_year as year, lp.goal, lp.level,
               coalesce(round(100.0 * count(ls.id) filter (where ls.status = 'done') / nullif(count(ls.id), 0)), 0)::int as percent
        from learning_profiles lp
        left join learning_paths p on p.user_id = lp.user_id and p.active
        left join learning_steps ls on ls.path_id = p.id
        where lp.school_id = ${id} and lp.share_with_school
        group by lp.user_id, lp.school_year, lp.goal, lp.level
      `)) as unknown as LearnerRow[],
    );
    const cohort = aggregateCohort(rows);
    let topResources: { title: string; type: string; source: string; completedBy: number }[] = [];
    if (!cohort.suppressed) {
      topResources = Array.from(
        (await db.execute(sql`
          select c.title, c.type, c.source, count(distinct ls.user_id)::int as "completedBy"
          from learning_steps ls
          join learning_paths p on p.id = ls.path_id and p.active
          join learning_profiles lp on lp.user_id = ls.user_id and lp.school_id = ${id} and lp.share_with_school
          join contents c on c.id = ls.content_id
          where ls.status = 'done'
          group by c.id
          having count(distinct ls.user_id) >= ${MIN_COHORT}
          order by "completedBy" desc
          limit 10
        `)) as unknown as { title: string; type: string; source: string; completedBy: number }[],
      );
    }
    return reply.status(200).send({ ...cohort, topResources });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** Official past exams and material from the school itself. Pushing the same link again updates it. */
export async function handlePutResources(request: FastifyRequest, reply: FastifyReply) {
  try {
    const list = ((request.body ?? {}) as { resources?: unknown }).resources;
    if (!Array.isArray(list) || list.length === 0) return reply.status(400).send({ error: 'Send { "resources": [ ... ] } with at least one item.' });
    if (list.length > MAX_BATCH) return reply.status(400).send({ error: `At most ${MAX_BATCH} resources per request.` });
    const parsed = list.map((r) => parseResource(r));
    const bad = parsed.findIndex((p) => !p.ok);
    if (bad !== -1) return reply.status(400).send({ error: `resources[${bad}]: ${(parsed[bad] as { error: string }).error}` });
    const school = schoolOf(request);
    for (const p of parsed) {
      const v = (p as { ok: true; value: ResourceInput }).value;
      await db
        .insert(campusResources)
        .values({ ...v, schoolId: school.id, userId: null, official: true, status: 'approved' })
        .onConflictDoUpdate({
          target: [campusResources.schoolId, campusResources.url],
          set: { title: v.title, kind: v.kind, subject: v.subject, year: v.year, studyYear: v.studyYear, description: v.description, official: true, status: 'approved' },
        });
    }
    return reply.status(200).send({ upserted: parsed.length });
  } catch (e) {
    return fail(request, reply, e);
  }
}
