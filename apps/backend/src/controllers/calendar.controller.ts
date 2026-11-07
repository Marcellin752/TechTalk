import { FastifyRequest, FastifyReply } from 'fastify';
import { and, asc, eq, gte, isNotNull, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { calendarEvents, contents, learningPaths, learningProfiles, learningSteps, schoolEvents, schools, campusSessions, campusSessionMembers } from '../db/schema.js';
import { buildIcs, planSessions } from '../services/calendar.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const KINDS = ['study', 'school', 'deadline', 'event'] as const;
type Kind = (typeof KINDS)[number];
const MAX_RANGE_DAYS = 93;
const userId = (r: FastifyRequest) => (r.user as { id: string }).id;

const eventShape = {
  id: calendarEvents.id, title: calendarEvents.title, kind: calendarEvents.kind, startsAt: calendarEvents.startsAt,
  endsAt: calendarEvents.endsAt, notes: calendarEvents.notes, done: calendarEvents.done, stepId: calendarEvents.stepId,
  contentId: calendarEvents.contentId, contentUrl: contents.url, contentType: contents.type,
};

function parseDate(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function listFor(uid: string, from: Date, to: Date) {
  const own = await db
    .select(eventShape)
    .from(calendarEvents)
    .leftJoin(contents, eq(contents.id, calendarEvents.contentId))
    .where(and(eq(calendarEvents.userId, uid), gte(calendarEvents.startsAt, from), lt(calendarEvents.startsAt, to)))
    .orderBy(asc(calendarEvents.startsAt));
  const fromSchool = [...(await schoolEventsFor(uid, from, to)), ...(await joinedSessions(uid, from, to))];
  return [...own.map((e) => ({ ...e, source: 'personal' as const, schoolName: null as string | null })), ...fromSchool].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/** Revision sessions the learner has joined, shown read-only: leaving is done on the Campus page. */
async function joinedSessions(uid: string, from: Date, to: Date) {
  const rows = await db
    .select({ id: campusSessions.id, title: campusSessions.title, startsAt: campusSessions.startsAt, endsAt: campusSessions.endsAt, place: campusSessions.place, onlineUrl: campusSessions.onlineUrl, subject: campusSessions.subject })
    .from(campusSessionMembers)
    .innerJoin(campusSessions, eq(campusSessions.id, campusSessionMembers.sessionId))
    .where(and(eq(campusSessionMembers.userId, uid), gte(campusSessions.startsAt, from), lt(campusSessions.startsAt, to)))
    .orderBy(asc(campusSessions.startsAt));
  return rows.map((r) => ({
    id: `campus:${r.id}`, title: r.title, kind: 'study', startsAt: r.startsAt, endsAt: r.endsAt,
    notes: [r.subject, r.place, r.onlineUrl].filter(Boolean).join(' · ').slice(0, 500) || null, done: false,
    stepId: null, contentId: null, contentUrl: r.onlineUrl, contentType: null, source: 'school' as const, schoolName: 'Campus' as string | null,
  }));
}

/** What the learner's school pushed for them: read-only, for their year (or every year). */
async function schoolEventsFor(uid: string, from: Date, to: Date) {
  const [lp] = await db.select({ schoolId: learningProfiles.schoolId, year: learningProfiles.schoolYear }).from(learningProfiles).where(eq(learningProfiles.userId, uid)).limit(1);
  if (!lp?.schoolId) return [];
  const rows = await db
    .select({ id: schoolEvents.id, title: schoolEvents.title, kind: schoolEvents.kind, startsAt: schoolEvents.startsAt, endsAt: schoolEvents.endsAt, notes: schoolEvents.notes, schoolName: schools.name })
    .from(schoolEvents)
    .innerJoin(schools, eq(schools.id, schoolEvents.schoolId))
    .where(and(eq(schoolEvents.schoolId, lp.schoolId), gte(schoolEvents.startsAt, from), lt(schoolEvents.startsAt, to), or(isNull(schoolEvents.year), eq(schoolEvents.year, lp.year ?? -1))))
    .orderBy(asc(schoolEvents.startsAt));
  return rows.map((r) => ({
    id: `school:${r.id}`, title: r.title, kind: r.kind, startsAt: r.startsAt, endsAt: r.endsAt, notes: r.notes, done: false,
    stepId: null, contentId: null, contentUrl: null, contentType: null, source: 'school' as const, schoolName: r.schoolName as string | null,
  }));
}

export async function handleListEvents(request: FastifyRequest, reply: FastifyReply) {
  try {
    const q = request.query as { from?: string; to?: string };
    const from = parseDate(q.from);
    const to = parseDate(q.to);
    if (!from || !to || to <= from) return reply.status(400).send({ error: 'Give a valid from and to.' });
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) return reply.status(400).send({ error: `Ask for at most ${MAX_RANGE_DAYS} days at a time.` });
    return reply.status(200).send({ events: await listFor(userId(request), from, to) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/** Validates the fields a person can set on an event. Returns the clean values or a message. */
export function parseEvent(body: unknown, partial: boolean): { ok: true; values: Record<string, unknown> } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  if (!partial || b.title !== undefined) {
    const title = typeof b.title === 'string' ? b.title.trim() : '';
    if (!title) return { ok: false, error: 'Give the event a title.' };
    if (title.length > 160) return { ok: false, error: 'Titles are limited to 160 characters.' };
    values.title = title;
  }
  if (!partial || b.kind !== undefined) {
    if (!KINDS.includes(b.kind as Kind)) return { ok: false, error: 'Kind must be study, school, deadline or event.' };
    values.kind = b.kind;
  }
  if (!partial || b.startsAt !== undefined) {
    const d = parseDate(b.startsAt);
    if (!d) return { ok: false, error: 'Start time is not a valid date.' };
    values.startsAt = d;
  }
  if (!partial || b.endsAt !== undefined) {
    const d = parseDate(b.endsAt);
    if (!d) return { ok: false, error: 'End time is not a valid date.' };
    values.endsAt = d;
  }
  if (b.notes !== undefined) {
    if (b.notes !== null && (typeof b.notes !== 'string' || b.notes.length > 500)) return { ok: false, error: 'Notes are limited to 500 characters.' };
    values.notes = b.notes ? (b.notes as string).trim() || null : null;
  }
  if (b.done !== undefined) {
    if (typeof b.done !== 'boolean') return { ok: false, error: 'done must be true or false.' };
    values.done = b.done;
  }
  return { ok: true, values };
}

export async function handleCreateEvent(request: FastifyRequest, reply: FastifyReply) {
  try {
    const parsed = parseEvent(request.body, false);
    if (!parsed.ok) return reply.status(400).send({ error: parsed.error });
    const v = parsed.values as { startsAt: Date; endsAt: Date } & Record<string, unknown>;
    if (v.endsAt <= v.startsAt) return reply.status(400).send({ error: 'The end must come after the start.' });
    if (v.endsAt.getTime() - v.startsAt.getTime() > 14 * 86_400_000) return reply.status(400).send({ error: 'An event cannot last more than 14 days.' });
    const uid = userId(request);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(calendarEvents).where(eq(calendarEvents.userId, uid));
    if (n >= 1000) return reply.status(409).send({ error: 'Your calendar is full. Delete old events first.' });

    const [row] = await db.insert(calendarEvents).values({ ...(v as any), userId: uid }).returning({ id: calendarEvents.id });
    const [event] = await listById(uid, row!.id);
    return reply.status(201).send({ event });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

function listById(uid: string, id: string) {
  return db
    .select(eventShape)
    .from(calendarEvents)
    .leftJoin(contents, eq(contents.id, calendarEvents.contentId))
    .where(and(eq(calendarEvents.userId, uid), eq(calendarEvents.id, id)))
    .limit(1);
}

export async function handleUpdateEvent(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid event id.' });
    const parsed = parseEvent(request.body, true);
    if (!parsed.ok) return reply.status(400).send({ error: parsed.error });
    const uid = userId(request);
    const [current] = await db.select().from(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, uid))).limit(1);
    if (!current) return reply.status(404).send({ error: 'Event not found.' });

    const v = parsed.values as { startsAt?: Date; endsAt?: Date; done?: boolean } & Record<string, unknown>;
    const startsAt = v.startsAt ?? current.startsAt;
    const endsAt = v.endsAt ?? current.endsAt;
    if (endsAt <= startsAt) return reply.status(400).send({ error: 'The end must come after the start.' });

    if (Object.keys(v).length > 0) await db.update(calendarEvents).set(v as any).where(eq(calendarEvents.id, id));

    // Finishing a study session that covers a path step finishes the step too.
    if (v.done === true && current.stepId) {
      await db
        .update(learningSteps)
        .set({ status: 'done', completedAt: new Date(), startedAt: sql`coalesce(${learningSteps.startedAt}, now())` })
        .where(and(eq(learningSteps.id, current.stepId), eq(learningSteps.userId, uid), ne(learningSteps.status, 'done')));
    }
    const [event] = await listById(uid, id);
    return reply.status(200).send({ event });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleDeleteEvent(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid event id.' });
    const deleted = await db.delete(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, userId(request)))).returning({ id: calendarEvents.id });
    if (deleted.length === 0) return reply.status(404).send({ error: 'Event not found.' });
    return reply.status(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/** Schedules the remaining steps of the active path, replacing earlier automatic sessions. */
export async function handlePlan(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const b = (request.body ?? {}) as { startHour?: unknown; days?: unknown; weeks?: unknown; tzOffset?: unknown; pathId?: unknown };
    const startHour = Number.isInteger(b.startHour) ? (b.startHour as number) : 18;
    const tzOffset = Number.isFinite(b.tzOffset) ? Math.max(-840, Math.min(840, b.tzOffset as number)) : 0;
    const weeks = Number.isInteger(b.weeks) ? Math.min(12, Math.max(1, b.weeks as number)) : 4;
    const days = Array.isArray(b.days) ? (b.days as unknown[]).filter((d): d is number => Number.isInteger(d)) : [1, 2, 3, 4, 5];
    if (startHour < 0 || startHour > 21) return reply.status(400).send({ error: 'Start hour must be between 0 and 21.' });
    if (days.length === 0) return reply.status(400).send({ error: 'Pick at least one day.' });

    // The path to lay out: the one asked for, otherwise the main one.
    if (b.pathId !== undefined && (typeof b.pathId !== 'string' || !UUID_RE.test(b.pathId))) return reply.status(400).send({ error: 'Invalid path id.' });
    const [path] = await db.select().from(learningPaths).where(and(eq(learningPaths.userId, uid), b.pathId ? eq(learningPaths.id, b.pathId as string) : eq(learningPaths.active, true))).limit(1);
    if (!path) return reply.status(409).send({ error: 'Build your learning path first.' });
    const [profile] = await db.select({ h: learningProfiles.hoursPerWeek }).from(learningProfiles).where(eq(learningProfiles.userId, uid)).limit(1);

    const steps = await db
      .select({ id: learningSteps.id, contentId: learningSteps.contentId, minutes: learningSteps.minutes, title: contents.title })
      .from(learningSteps)
      .innerJoin(contents, eq(contents.id, learningSteps.contentId))
      .where(and(eq(learningSteps.pathId, path.id), ne(learningSteps.status, 'done')))
      .orderBy(asc(learningSteps.position));

    const sessions = planSessions(steps, {
      weeklyMinutes: (profile?.h ?? path.hoursPerWeek) * 60, startHour, tzOffset, days, weeks, from: new Date(),
    });

    // Earlier automatic sessions (the ones tied to a step) that are still ahead and not done.
    await db.delete(calendarEvents).where(and(eq(calendarEvents.userId, uid), eq(calendarEvents.kind, 'study'), isNotNull(calendarEvents.stepId), eq(calendarEvents.done, false), gte(calendarEvents.startsAt, new Date())));
    if (sessions.length > 0) {
      await db.insert(calendarEvents).values(sessions.map((s) => ({ userId: uid, title: s.title.slice(0, 160), kind: 'study', startsAt: s.startsAt, endsAt: s.endsAt, stepId: s.stepId, contentId: s.contentId })));
    }
    return reply.status(200).send({ planned: sessions.length });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleExportIcs(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const own = await db
      .select({ id: calendarEvents.id, title: calendarEvents.title, kind: calendarEvents.kind, startsAt: calendarEvents.startsAt, endsAt: calendarEvents.endsAt, notes: calendarEvents.notes })
      .from(calendarEvents)
      .where(eq(calendarEvents.userId, uid))
      .orderBy(asc(calendarEvents.startsAt))
      .limit(2000);
    const fromSchool = (await schoolEventsFor(uid, new Date(Date.now() - 30 * 86_400_000), new Date(Date.now() + 400 * 86_400_000))).map((e) => ({ id: e.id, title: e.title, kind: e.kind, startsAt: e.startsAt, endsAt: e.endsAt, notes: e.notes }));
    const rows = [...own, ...fromSchool];
    return reply
      .header('Content-Type', 'text/calendar; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="techtalk.ics"')
      .status(200)
      .send(buildIcs(rows));
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}
