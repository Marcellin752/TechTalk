import { FastifyRequest, FastifyReply } from 'fastify';
import { and, asc, desc, eq, gte, ilike, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import {
  campusProfiles, campusResourceReports, campusResourceVotes, campusResources, campusSessionMembers, campusSessions,
  learningProfiles, schools, users,
} from '../db/schema.js';
import { listPaths, pathView } from '../services/learning/paths-store.js';
import { AUTO_HIDE_REPORTS, parseCampusProfile, parseResource, parseSession, rankPeople, RESOURCE_KINDS } from '../services/campus.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const userId = (r: FastifyRequest) => (r.user as { id: string }).id;
const like = (s: string) => `%${s.replace(/[%_\\]/g, '\\$&')}%`;
const page = (q: { limit?: string; offset?: string }, def = 20) => ({
  limit: Math.min(Math.max(parseInt(q.limit || String(def), 10) || def, 1), 50),
  offset: Math.max(parseInt(q.offset || '0', 10) || 0, 0),
});

interface Campus { uid: string; schoolId: string; schoolName: string; year: number | null; topics: string[] }

/** The campus is for learners who linked a school that has joined. Everything is scoped to it. */
async function campusOf(request: FastifyRequest, reply: FastifyReply): Promise<Campus | null> {
  const uid = userId(request);
  const [row] = await db
    .select({ schoolId: learningProfiles.schoolId, year: learningProfiles.schoolYear, topics: learningProfiles.schoolTopics, name: schools.name, active: schools.active })
    .from(learningProfiles)
    .leftJoin(schools, eq(schools.id, learningProfiles.schoolId))
    .where(eq(learningProfiles.userId, uid))
    .limit(1);
  if (!row?.schoolId || !row.active) {
    reply.status(403).send({ error: 'Link your school on My path to use the campus.', code: 'no_school' });
    return null;
  }
  return { uid, schoolId: row.schoolId, schoolName: row.name!, year: row.year, topics: row.topics ?? [] };
}

const fail = (request: FastifyRequest, reply: FastifyReply, error: unknown) => {
  request.log.error(error);
  return reply.status(500).send({ error: 'Internal server error.' });
};

/* ------------------------------ programme ------------------------------ */

/**
 * The school's programme, year by year: what students do (modules, projects) and the skills
 * each year builds, with the learner's own progress on every project when they follow a
 * school path for that year.
 */
export async function handleProgramme(request: FastifyRequest, reply: FastifyReply) {
  try {
    const c = await campusOf(request, reply);
    if (!c) return;
    const [school] = await db.select({ curriculum: schools.curriculum }).from(schools).where(eq(schools.id, c.schoolId)).limit(1);
    const programme = school?.curriculum.programme ?? null;

    // The learner's school paths, by year, and how far they are on each project (a stage of that path).
    const mine = (await listPaths(c.uid)).filter((p) => p.kind === 'school');
    const byYear = new Map<number, { id: string; percent: number; stages: Map<string, { done: number; total: number }> }>();
    for (const p of mine) {
      const view = await pathView(c.uid, p.id);
      if (!view) continue;
      byYear.set(p.schoolYear ?? 1, { id: p.id, percent: p.progress.percent, stages: new Map(view.stages.map((st) => [st.title, { done: st.done, total: st.total }])) });
    }

    return reply.status(200).send({
      school: { name: c.schoolName },
      myYear: c.year,
      status: programme?.status ?? null,
      years: (programme?.years ?? []).map((y) => {
        const path = byYear.get(y.year);
        return {
          year: y.year,
          title: y.title,
          summary: y.summary ?? null,
          // The skills of a year are what its projects teach, most common first.
          skills: [...y.projects.flatMap((p) => p.topics).reduce((m, t) => m.set(t, (m.get(t) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1]).map(([t]) => t).slice(0, 14),
          hours: y.projects.reduce((n, p) => n + (p.hours ?? 0), 0),
          path: path ? { id: path.id, percent: path.percent } : null,
          projects: y.projects.map((p) => ({ name: p.name, summary: p.summary ?? null, topics: p.topics, kind: p.kind ?? 'project', hours: p.hours ?? null, progress: path?.stages.get(p.name) ?? null })),
        };
      }),
    });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/* ------------------------------ overview ------------------------------ */

export async function handleCampusOverview(request: FastifyRequest, reply: FastifyReply) {
  try {
    const c = await campusOf(request, reply);
    if (!c) return;
    const [[r], [s], [p], [mine]] = await Promise.all([
      db.select({ n: sql<number>`count(*)::int` }).from(campusResources).where(and(eq(campusResources.schoolId, c.schoolId), eq(campusResources.status, 'approved'))),
      db.select({ n: sql<number>`count(*)::int` }).from(campusSessions).where(and(eq(campusSessions.schoolId, c.schoolId), gte(campusSessions.endsAt, new Date()))),
      db.select({ n: sql<number>`count(*)::int` }).from(campusProfiles).innerJoin(learningProfiles, eq(learningProfiles.userId, campusProfiles.userId)).where(and(eq(learningProfiles.schoolId, c.schoolId), eq(campusProfiles.discoverable, true))),
      db.select().from(campusProfiles).where(eq(campusProfiles.userId, c.uid)).limit(1),
    ]);
    return reply.status(200).send({
      school: { name: c.schoolName, year: c.year },
      counts: { resources: r!.n, sessions: s!.n, people: p!.n },
      me: mine ?? { discoverable: false, headline: null, lookingFor: null, contact: null },
    });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/* ------------------------------ annales ------------------------------ */

export async function handleListResources(request: FastifyRequest, reply: FastifyReply) {
  try {
    const c = await campusOf(request, reply);
    if (!c) return;
    const q = request.query as { q?: string; subject?: string; kind?: string; studyYear?: string; limit?: string; offset?: string };
    const { limit, offset } = page(q);
    const conds = [eq(campusResources.schoolId, c.schoolId), eq(campusResources.status, 'approved')];
    if (q.q?.trim()) conds.push(or(ilike(campusResources.title, like(q.q.trim().slice(0, 80))), ilike(campusResources.subject, like(q.q.trim().slice(0, 80)))) as never);
    if (q.subject?.trim()) conds.push(ilike(campusResources.subject, like(q.subject.trim().slice(0, 80))) as never);
    if (q.kind && (RESOURCE_KINDS as readonly string[]).includes(q.kind)) conds.push(eq(campusResources.kind, q.kind));
    const sy = Number(q.studyYear);
    if (Number.isInteger(sy) && sy >= 1 && sy <= 8) conds.push(eq(campusResources.studyYear, sy));
    const where = and(...conds);

    const rows = await db
      .select({
        id: campusResources.id, title: campusResources.title, kind: campusResources.kind, subject: campusResources.subject, year: campusResources.year,
        studyYear: campusResources.studyYear, url: campusResources.url, description: campusResources.description, official: campusResources.official,
        votes: campusResources.votes, createdAt: campusResources.createdAt, mine: sql<boolean>`${campusResources.userId} = ${c.uid}`,
        voted: sql<boolean>`exists (select 1 from campus_resource_votes v where v.resource_id = ${campusResources.id} and v.user_id = ${c.uid})`,
      })
      .from(campusResources)
      .where(where)
      .orderBy(desc(campusResources.official), desc(campusResources.votes), desc(campusResources.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(campusResources).where(where);
    const subjects = await db
      .selectDistinct({ subject: campusResources.subject })
      .from(campusResources)
      .where(and(eq(campusResources.schoolId, c.schoolId), eq(campusResources.status, 'approved')))
      .orderBy(asc(campusResources.subject))
      .limit(100);
    return reply.status(200).send({ resources: rows, total, subjects: subjects.map((s) => s.subject) });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleCreateResource(request: FastifyRequest, reply: FastifyReply) {
  try {
    const c = await campusOf(request, reply);
    if (!c) return;
    const parsed = parseResource(request.body);
    if (!parsed.ok) return reply.status(400).send({ error: parsed.error });
    // A daily cap keeps the library from being flooded.
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(campusResources).where(and(eq(campusResources.userId, c.uid), gte(campusResources.createdAt, new Date(Date.now() - 86_400_000))));
    if (n >= 10) return reply.status(429).send({ error: 'You shared a lot today. Come back tomorrow.' });
    const [dup] = await db.select({ id: campusResources.id }).from(campusResources).where(and(eq(campusResources.schoolId, c.schoolId), eq(campusResources.url, parsed.value.url))).limit(1);
    if (dup) return reply.status(409).send({ error: 'This link is already in the library.' });
    const [row] = await db.insert(campusResources).values({ ...parsed.value, schoolId: c.schoolId, userId: c.uid }).returning({ id: campusResources.id });
    return reply.status(201).send({ id: row!.id });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** Takes the learner's vote on or off. */
export async function handleVoteResource(request: FastifyRequest, reply: FastifyReply) {
  try {
    const c = await campusOf(request, reply);
    if (!c) return;
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id.' });
    const result = await db.transaction(async (tx) => {
      const [res] = await tx.select({ id: campusResources.id }).from(campusResources).where(and(eq(campusResources.id, id), eq(campusResources.schoolId, c.schoolId), eq(campusResources.status, 'approved'))).limit(1);
      if (!res) return null;
      const removed = await tx.delete(campusResourceVotes).where(and(eq(campusResourceVotes.resourceId, id), eq(campusResourceVotes.userId, c.uid))).returning({ id: campusResourceVotes.resourceId });
      if (removed.length === 0) await tx.insert(campusResourceVotes).values({ resourceId: id, userId: c.uid });
      const [updated] = await tx.update(campusResources).set({ votes: sql`${campusResources.votes} + ${removed.length === 0 ? 1 : -1}` }).where(eq(campusResources.id, id)).returning({ votes: campusResources.votes });
      return { voted: removed.length === 0, votes: updated!.votes };
    });
    if (!result) return reply.status(404).send({ error: 'Not found.' });
    return reply.status(200).send(result);
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleReportResource(request: FastifyRequest, reply: FastifyReply) {
  try {
    const c = await campusOf(request, reply);
    if (!c) return;
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id.' });
    const reason = String(((request.body ?? {}) as { reason?: unknown }).reason ?? '').trim().slice(0, 200) || null;
    const hidden = await db.transaction(async (tx) => {
      const [res] = await tx.select({ id: campusResources.id, official: campusResources.official }).from(campusResources).where(and(eq(campusResources.id, id), eq(campusResources.schoolId, c.schoolId))).limit(1);
      if (!res) return null;
      const inserted = await tx.insert(campusResourceReports).values({ resourceId: id, userId: c.uid, reason }).onConflictDoNothing().returning({ id: campusResourceReports.resourceId });
      if (inserted.length === 0) return false; // already reported by this learner
      const [updated] = await tx.update(campusResources).set({ reports: sql`${campusResources.reports} + 1` }).where(eq(campusResources.id, id)).returning({ reports: campusResources.reports });
      // Several independent reports hide it until an administrator decides. The school's own material is never auto-hidden.
      if (!res.official && updated!.reports >= AUTO_HIDE_REPORTS) {
        await tx.update(campusResources).set({ status: 'hidden' }).where(eq(campusResources.id, id));
        return true;
      }
      return false;
    });
    if (hidden === null) return reply.status(404).send({ error: 'Not found.' });
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleDeleteResource(request: FastifyRequest, reply: FastifyReply) {
  try {
    const c = await campusOf(request, reply);
    if (!c) return;
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id.' });
    const deleted = await db.delete(campusResources).where(and(eq(campusResources.id, id), eq(campusResources.userId, c.uid), eq(campusResources.schoolId, c.schoolId))).returning({ id: campusResources.id });
    if (deleted.length === 0) return reply.status(404).send({ error: 'Not found, or not yours.' });
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}

/* ------------------------------ revisions ------------------------------ */

const sessionRows = (c: Campus, where: ReturnType<typeof and>) =>
  db
    .select({
      id: campusSessions.id, title: campusSessions.title, subject: campusSessions.subject, description: campusSessions.description,
      startsAt: campusSessions.startsAt, endsAt: campusSessions.endsAt, place: campusSessions.place, onlineUrl: campusSessions.onlineUrl,
      capacity: campusSessions.capacity, hostId: campusSessions.hostId, hostName: users.name, hostPicture: users.picture,
      members: sql<number>`(select count(*)::int from campus_session_members m where m.session_id = ${campusSessions.id})`,
      joined: sql<boolean>`exists (select 1 from campus_session_members m where m.session_id = ${campusSessions.id} and m.user_id = ${c.uid})`,
    })
    .from(campusSessions)
    .innerJoin(users, eq(users.id, campusSessions.hostId))
    .where(where)
    .orderBy(asc(campusSessions.startsAt))
    .limit(60);

export async function handleListSessions(request: FastifyRequest, reply: FastifyReply) {
  try {
    const c = await campusOf(request, reply);
    if (!c) return;
    const q = request.query as { subject?: string };
    const conds = [eq(campusSessions.schoolId, c.schoolId), gte(campusSessions.endsAt, new Date())];
    if (q.subject?.trim()) conds.push(ilike(campusSessions.subject, like(q.subject.trim().slice(0, 80))) as never);
    const rows = await sessionRows(c, and(...conds));
    return reply.status(200).send({ sessions: rows.map((r) => ({ ...r, mine: r.hostId === c.uid, full: r.members >= r.capacity })) });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleCreateSession(request: FastifyRequest, reply: FastifyReply) {
  try {
    const c = await campusOf(request, reply);
    if (!c) return;
    const parsed = parseSession(request.body);
    if (!parsed.ok) return reply.status(400).send({ error: parsed.error });
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(campusSessions).where(and(eq(campusSessions.hostId, c.uid), gte(campusSessions.endsAt, new Date())));
    if (n >= 5) return reply.status(409).send({ error: 'You already host 5 upcoming sessions.' });
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(campusSessions).values({ ...parsed.value, schoolId: c.schoolId, hostId: c.uid }).returning({ id: campusSessions.id });
      await tx.insert(campusSessionMembers).values({ sessionId: row!.id, userId: c.uid }); // the host is the first to come
      return row!.id;
    });
    return reply.status(201).send({ id });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleJoinSession(request: FastifyRequest, reply: FastifyReply) {
  try {
    const c = await campusOf(request, reply);
    if (!c) return;
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id.' });
    const outcome = await db.transaction(async (tx) => {
      // The row lock makes two people taking the last seat at once safe.
      const [s] = await tx.select().from(campusSessions).where(and(eq(campusSessions.id, id), eq(campusSessions.schoolId, c.schoolId))).for('update').limit(1);
      if (!s) return 'missing' as const;
      if (s.endsAt <= new Date()) return 'over' as const;
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(campusSessionMembers).where(eq(campusSessionMembers.sessionId, id));
      const [already] = await tx.select({ id: campusSessionMembers.sessionId }).from(campusSessionMembers).where(and(eq(campusSessionMembers.sessionId, id), eq(campusSessionMembers.userId, c.uid))).limit(1);
      if (already) return 'ok' as const;
      if (n >= s.capacity) return 'full' as const;
      await tx.insert(campusSessionMembers).values({ sessionId: id, userId: c.uid });
      return 'ok' as const;
    });
    if (outcome === 'missing') return reply.status(404).send({ error: 'Session not found.' });
    if (outcome === 'over') return reply.status(409).send({ error: 'This session is over.' });
    if (outcome === 'full') return reply.status(409).send({ error: 'This session is full.' });
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleLeaveSession(request: FastifyRequest, reply: FastifyReply) {
  try {
    const c = await campusOf(request, reply);
    if (!c) return;
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id.' });
    const [s] = await db.select({ hostId: campusSessions.hostId }).from(campusSessions).where(and(eq(campusSessions.id, id), eq(campusSessions.schoolId, c.schoolId))).limit(1);
    if (!s) return reply.status(404).send({ error: 'Session not found.' });
    if (s.hostId === c.uid) return reply.status(409).send({ error: 'You host this session: cancel it instead.' });
    await db.delete(campusSessionMembers).where(and(eq(campusSessionMembers.sessionId, id), eq(campusSessionMembers.userId, c.uid)));
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleCancelSession(request: FastifyRequest, reply: FastifyReply) {
  try {
    const c = await campusOf(request, reply);
    if (!c) return;
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id.' });
    const deleted = await db.delete(campusSessions).where(and(eq(campusSessions.id, id), eq(campusSessions.hostId, c.uid))).returning({ id: campusSessions.id });
    if (deleted.length === 0) return reply.status(404).send({ error: 'Not found, or not yours.' });
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}

/* ------------------------------ people ------------------------------ */

export async function handleUpdateCampusProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const c = await campusOf(request, reply);
    if (!c) return;
    const parsed = parseCampusProfile(request.body);
    if (!parsed.ok) return reply.status(400).send({ error: parsed.error });
    if (Object.keys(parsed.value).length === 0) return reply.status(400).send({ error: 'Nothing to change.' });
    const [row] = await db
      .insert(campusProfiles)
      .values({ userId: c.uid, ...parsed.value })
      .onConflictDoUpdate({ target: campusProfiles.userId, set: { ...parsed.value, updatedAt: new Date() } })
      .returning();
    return reply.status(200).send({ me: row });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** Students of the same school who chose to be listed. Never emails; best matches first. */
export async function handleListPeople(request: FastifyRequest, reply: FastifyReply) {
  try {
    const c = await campusOf(request, reply);
    if (!c) return;
    const q = request.query as { topic?: string; year?: string; lookingFor?: string };
    const [mine] = await db.select({ lookingFor: campusProfiles.lookingFor }).from(campusProfiles).where(eq(campusProfiles.userId, c.uid)).limit(1);
    const conds = [eq(learningProfiles.schoolId, c.schoolId), eq(campusProfiles.discoverable, true), ne(learningProfiles.userId, c.uid)];
    const yr = Number(q.year);
    if (Number.isInteger(yr) && yr >= 1 && yr <= 8) conds.push(eq(learningProfiles.schoolYear, yr));
    if (q.lookingFor) conds.push(eq(campusProfiles.lookingFor, q.lookingFor.slice(0, 12)));
    const rows = await db
      .select({
        userId: users.id, name: users.name, picture: users.picture, year: learningProfiles.schoolYear, topics: learningProfiles.schoolTopics,
        headline: campusProfiles.headline, lookingFor: campusProfiles.lookingFor, contact: campusProfiles.contact, handle: sql<string | null>`(select ps.handle from profile_settings ps where ps.user_id = ${users.id} and ps.is_public)`,
      })
      .from(campusProfiles)
      .innerJoin(learningProfiles, eq(learningProfiles.userId, campusProfiles.userId))
      .innerJoin(users, eq(users.id, campusProfiles.userId))
      .where(and(...conds))
      .limit(300);
    let people = rankPeople({ year: c.year, topics: c.topics, lookingFor: mine?.lookingFor ?? null }, rows.map((r) => ({ ...r, topics: r.topics ?? [] })));
    const topic = q.topic?.trim().toLowerCase();
    if (topic) people = people.filter((p) => p.topics.includes(topic));
    return reply.status(200).send({ people: people.slice(0, 40).map(({ userId: _id, score: _s, ...p }) => ({ id: _id, ...p })) });
  } catch (e) {
    return fail(request, reply, e);
  }
}
