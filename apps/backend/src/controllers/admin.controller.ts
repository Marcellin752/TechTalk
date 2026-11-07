import { FastifyRequest, FastifyReply } from 'fastify';
import { and, desc, eq, gt, gte, ilike, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { adminAudit, comments, contents, kairosMessages, learningPaths, learningProfiles, profileSettings, refreshTokens, schools, users, campusResources } from '../db/schema.js';
import { generateApiKey, parseCurriculum, presetCurriculum, slugify } from '../services/schools.js';
import { revokeAllRefreshTokens } from '../services/session.js';
import { startSync, syncState } from '../services/automation/index.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const adminOf = (r: FastifyRequest) => r.user as { id: string; email: string };
const page = (q: { limit?: string; offset?: string }) => ({
  limit: Math.min(Math.max(parseInt(q.limit || '25', 10) || 25, 1), 100),
  offset: Math.max(parseInt(q.offset || '0', 10) || 0, 0),
});
const like = (s: string) => `%${s.replace(/[%_\\]/g, '\\$&')}%`;

async function audit(r: FastifyRequest, action: string, target?: string) {
  const a = adminOf(r);
  await db.insert(adminAudit).values({ adminId: a.id, adminEmail: a.email, action, target: target?.slice(0, 200) ?? null });
}

/** The token says "admin", but the database decides: a demoted admin loses access at once. */
export async function requireDatabaseAdmin(request: FastifyRequest, reply: FastifyReply) {
  const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, (request.user as { id: string }).id)).limit(1);
  if (row?.role !== 'admin') return reply.status(403).send({ error: 'Forbidden', message: 'Administrators only.' });
}

const fail = (request: FastifyRequest, reply: FastifyReply, error: unknown) => {
  request.log.error(error);
  return reply.status(500).send({ error: 'Internal server error.' });
};

export async function handleStats(request: FastifyRequest, reply: FastifyReply) {
  try {
    const day = new Date(Date.now() - 86_400_000);
    const week = new Date(Date.now() - 7 * 86_400_000);
    const count = sql<number>`count(*)::int`;
    const [[u], [uWeek], [admins], [pub], [cm], [k1], [k7], [paths], [sessions], byType, bySource, recent] = await Promise.all([
      db.select({ n: count }).from(users),
      db.select({ n: count }).from(users).where(gte(users.createdAt, week)),
      db.select({ n: count }).from(users).where(eq(users.role, 'admin')),
      db.select({ n: count }).from(profileSettings).where(eq(profileSettings.isPublic, true)),
      db.select({ n: count }).from(comments),
      db.select({ n: count }).from(kairosMessages).where(and(eq(kairosMessages.role, 'user'), gte(kairosMessages.createdAt, day))),
      db.select({ n: count }).from(kairosMessages).where(and(eq(kairosMessages.role, 'user'), gte(kairosMessages.createdAt, week))),
      db.select({ n: count }).from(learningPaths).where(eq(learningPaths.active, true)),
      db.select({ n: count }).from(refreshTokens).where(and(isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date()))),
      db.select({ type: contents.type, n: count }).from(contents).groupBy(contents.type).orderBy(desc(count)),
      db.select({ source: contents.source, n: count, latest: sql<string>`max(${contents.createdAt})` }).from(contents).groupBy(contents.source).orderBy(desc(count)),
      db.select().from(adminAudit).orderBy(desc(adminAudit.createdAt)).limit(30),
    ]);
    return reply.status(200).send({
      users: { total: u!.n, lastWeek: uWeek!.n, admins: admins!.n, publicProfiles: pub!.n, activeSessions: sessions!.n },
      activity: { comments: cm!.n, kairosMessages24h: k1!.n, kairosMessages7d: k7!.n, activePaths: paths!.n },
      content: { byType, bySource, total: byType.reduce((n, r) => n + r.n, 0) },
      sync: syncState,
      audit: recent,
    });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleListUsers(request: FastifyRequest, reply: FastifyReply) {
  try {
    const q = request.query as { q?: string; limit?: string; offset?: string };
    const { limit, offset } = page(q);
    const term = (q.q ?? '').trim().slice(0, 100);
    const where = term ? or(ilike(users.name, like(term)), ilike(users.email, like(term))) : undefined;
    const rows = await db
      .select({
        id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt,
        hasPassword: sql<boolean>`${users.password} is not null`, google: sql<boolean>`${users.googleId} is not null`,
        githubLogin: users.githubLogin, github: sql<boolean>`${users.githubId} is not null`,
        isPublic: sql<boolean>`coalesce(${profileSettings.isPublic}, false)`, handle: profileSettings.handle,
      })
      .from(users)
      .leftJoin(profileSettings, eq(profileSettings.userId, users.id))
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(users).where(where);
    return reply.status(200).send({ users: rows, total });
  } catch (e) {
    return fail(request, reply, e);
  }
}

async function otherAdmins(excludeId: string): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(users).where(and(eq(users.role, 'admin'), ne(users.id, excludeId)));
  return n;
}

export async function handleSetRole(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    const role = ((request.body ?? {}) as { role?: string }).role;
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid user id.' });
    if (role !== 'user' && role !== 'admin') return reply.status(400).send({ error: 'Role must be user or admin.' });
    if (id === adminOf(request).id) return reply.status(409).send({ error: 'You cannot change your own role.' });
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) return reply.status(404).send({ error: 'User not found.' });
    if (target.role === 'admin' && role === 'user' && (await otherAdmins(id)) === 0) return reply.status(409).send({ error: 'There must always be at least one administrator.' });
    await db.update(users).set({ role }).where(eq(users.id, id));
    // The access token still says the old role for a few minutes: end the sessions so it applies now.
    await revokeAllRefreshTokens(id);
    await audit(request, `role:${role}`, target.email);
    return reply.status(200).send({ id, role });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleDeleteUser(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid user id.' });
    if (id === adminOf(request).id) return reply.status(409).send({ error: 'You cannot delete your own account here.' });
    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!target) return reply.status(404).send({ error: 'User not found.' });
    if (target.role === 'admin' && (await otherAdmins(id)) === 0) return reply.status(409).send({ error: 'There must always be at least one administrator.' });
    await db.delete(users).where(eq(users.id, id)); // everything of theirs cascades
    await audit(request, 'user:delete', target.email);
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleRevokeSessions(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid user id.' });
    const [target] = await db.select({ email: users.email }).from(users).where(eq(users.id, id)).limit(1);
    if (!target) return reply.status(404).send({ error: 'User not found.' });
    await revokeAllRefreshTokens(id);
    await audit(request, 'user:sign-out', target.email);
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleListComments(request: FastifyRequest, reply: FastifyReply) {
  try {
    const q = request.query as { q?: string; limit?: string; offset?: string };
    const { limit, offset } = page(q);
    const term = (q.q ?? '').trim().slice(0, 100);
    const where = term ? ilike(comments.body, like(term)) : undefined;
    const rows = await db
      .select({ id: comments.id, body: comments.body, createdAt: comments.createdAt, author: { id: users.id, name: users.name, email: users.email }, content: { id: contents.id, title: contents.title } })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.userId))
      .innerJoin(contents, eq(contents.id, comments.contentId))
      .where(where)
      .orderBy(desc(comments.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(comments).where(where);
    return reply.status(200).send({ comments: rows, total });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleDeleteComment(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid comment id.' });
    const deleted = await db.delete(comments).where(eq(comments.id, id)).returning({ id: comments.id });
    if (deleted.length === 0) return reply.status(404).send({ error: 'Comment not found.' });
    await audit(request, 'comment:delete', id);
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleListContents(request: FastifyRequest, reply: FastifyReply) {
  try {
    const q = request.query as { q?: string; type?: string; limit?: string; offset?: string };
    const { limit, offset } = page(q);
    const term = (q.q ?? '').trim().slice(0, 100);
    const conds = [term ? or(ilike(contents.title, like(term)), ilike(contents.source, like(term))) : undefined, q.type ? eq(contents.type, q.type.slice(0, 50)) : undefined].filter(Boolean);
    const where = conds.length ? and(...(conds as any[])) : undefined;
    const rows = await db
      .select({ id: contents.id, title: contents.title, url: contents.url, source: contents.source, type: contents.type, createdAt: contents.createdAt })
      .from(contents)
      .where(where)
      .orderBy(desc(contents.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(contents).where(where);
    return reply.status(200).send({ contents: rows, total });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleDeleteContent(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid content id.' });
    const deleted = await db.delete(contents).where(eq(contents.id, id)).returning({ title: contents.title });
    if (deleted.length === 0) return reply.status(404).send({ error: 'Content not found.' });
    await audit(request, 'content:delete', deleted[0]!.title);
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleSync(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (!startSync()) return reply.status(409).send({ error: 'A sync is already running.' });
    await audit(request, 'sync:start');
    return reply.status(202).send({ started: true });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleSyncStatus(_request: FastifyRequest, reply: FastifyReply) {
  return reply.status(200).send(syncState);
}

const schoolView = {
  id: schools.id, slug: schools.slug, name: schools.name, contactEmail: schools.contactEmail, active: schools.active, curriculum: schools.curriculum,
  keyPrefix: schools.apiKeyPrefix, keyCreatedAt: schools.apiKeyCreatedAt, lastUsedAt: schools.lastUsedAt, createdAt: schools.createdAt,
};

export async function handleListSchoolsAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    const rows = await db.select(schoolView).from(schools).orderBy(schools.name);
    const counts = await db
      .select({ schoolId: learningProfiles.schoolId, learners: sql<number>`count(*)::int`, sharing: sql<number>`count(*) filter (where ${learningProfiles.shareWithSchool})::int` })
      .from(learningProfiles)
      .where(sql`${learningProfiles.schoolId} is not null`)
      .groupBy(learningProfiles.schoolId);
    return reply.status(200).send({
      schools: rows.map((r) => ({ ...r, learners: counts.find((c) => c.schoolId === r.id)?.learners ?? 0, sharing: counts.find((c) => c.schoolId === r.id)?.sharing ?? 0 })),
    });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleCreateSchool(request: FastifyRequest, reply: FastifyReply) {
  try {
    const b = (request.body ?? {}) as { name?: unknown; contactEmail?: unknown; curriculum?: unknown };
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (name.length < 2 || name.length > 80) return reply.status(400).send({ error: 'Give the school a name (2-80 characters).' });
    const slug = slugify(name);
    if (!slug) return reply.status(400).send({ error: 'That name has no usable letters.' });
    if (b.contactEmail != null && (typeof b.contactEmail !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.contactEmail))) return reply.status(400).send({ error: 'Contact email is not valid.' });

    let curriculum = presetCurriculum(slug) ?? { years: [[]] };
    if (b.curriculum !== undefined) {
      const parsed = parseCurriculum(b.curriculum);
      if (!parsed.ok) return reply.status(400).send({ error: parsed.error });
      curriculum = parsed.curriculum;
    }
    const [exists] = await db.select({ id: schools.id }).from(schools).where(eq(schools.slug, slug)).limit(1);
    if (exists) return reply.status(409).send({ error: 'A school with this name already exists.' });
    const [created] = await db.insert(schools).values({ slug, name, contactEmail: (b.contactEmail as string | null) ?? null, curriculum }).returning(schoolView);
    await audit(request, 'school:create', name);
    return reply.status(201).send({ school: created });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleUpdateSchool(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid school id.' });
    const b = (request.body ?? {}) as { name?: unknown; contactEmail?: unknown; active?: unknown; curriculum?: unknown };
    const set: Record<string, unknown> = {};
    if (b.name !== undefined) {
      if (typeof b.name !== 'string' || b.name.trim().length < 2 || b.name.trim().length > 80) return reply.status(400).send({ error: 'Name must be 2-80 characters.' });
      set.name = b.name.trim();
    }
    if (b.contactEmail !== undefined) {
      if (b.contactEmail !== null && (typeof b.contactEmail !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.contactEmail))) return reply.status(400).send({ error: 'Contact email is not valid.' });
      set.contactEmail = b.contactEmail;
    }
    if (b.active !== undefined) {
      if (typeof b.active !== 'boolean') return reply.status(400).send({ error: 'active must be true or false.' });
      set.active = b.active;
    }
    if (b.curriculum !== undefined) {
      const parsed = parseCurriculum(b.curriculum);
      if (!parsed.ok) return reply.status(400).send({ error: parsed.error });
      set.curriculum = parsed.curriculum;
    }
    if (Object.keys(set).length === 0) return reply.status(400).send({ error: 'Nothing to change.' });
    const [updated] = await db.update(schools).set(set).where(eq(schools.id, id)).returning(schoolView);
    if (!updated) return reply.status(404).send({ error: 'School not found.' });
    await audit(request, 'school:update', updated.name);
    return reply.status(200).send({ school: updated });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** Issues a new API key and retires the old one. The key is in this response and nowhere else, ever. */
export async function handleRotateSchoolKey(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid school id.' });
    const { key, hash, prefix } = generateApiKey();
    const [updated] = await db.update(schools).set({ apiKeyHash: hash, apiKeyPrefix: prefix, apiKeyCreatedAt: new Date() }).where(eq(schools.id, id)).returning({ name: schools.name });
    if (!updated) return reply.status(404).send({ error: 'School not found.' });
    await audit(request, 'school:new-key', updated.name);
    return reply.status(200).send({ key, keyPrefix: prefix });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleDeleteSchool(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid school id.' });
    const deleted = await db.delete(schools).where(eq(schools.id, id)).returning({ name: schools.name });
    if (deleted.length === 0) return reply.status(404).send({ error: 'School not found.' });
    await audit(request, 'school:delete', deleted[0]!.name);
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** Shared exams and notes, hidden ones first: what the community reported. */
export async function handleListCampusResources(request: FastifyRequest, reply: FastifyReply) {
  try {
    const q = request.query as { status?: string; limit?: string; offset?: string };
    const { limit, offset } = page(q);
    const where = q.status === 'hidden' || q.status === 'approved' ? eq(campusResources.status, q.status) : undefined;
    const rows = await db
      .select({ id: campusResources.id, title: campusResources.title, subject: campusResources.subject, url: campusResources.url, status: campusResources.status, reports: campusResources.reports, votes: campusResources.votes, official: campusResources.official, school: schools.name, author: users.email, createdAt: campusResources.createdAt })
      .from(campusResources)
      .innerJoin(schools, eq(schools.id, campusResources.schoolId))
      .leftJoin(users, eq(users.id, campusResources.userId))
      .where(where)
      .orderBy(desc(campusResources.reports), desc(campusResources.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(campusResources).where(where);
    return reply.status(200).send({ resources: rows, total });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleSetCampusResourceStatus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    const status = ((request.body ?? {}) as { status?: string }).status;
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id.' });
    if (status !== 'approved' && status !== 'hidden') return reply.status(400).send({ error: 'Status must be approved or hidden.' });
    // Approving again clears the reports so it is not hidden by the very next one.
    const [row] = await db.update(campusResources).set({ status, ...(status === 'approved' ? { reports: 0 } : {}) }).where(eq(campusResources.id, id)).returning({ title: campusResources.title });
    if (!row) return reply.status(404).send({ error: 'Not found.' });
    await audit(request, `campus:${status}`, row.title);
    return reply.status(200).send({ id, status });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleDeleteCampusResource(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid id.' });
    const deleted = await db.delete(campusResources).where(eq(campusResources.id, id)).returning({ title: campusResources.title });
    if (deleted.length === 0) return reply.status(404).send({ error: 'Not found.' });
    await audit(request, 'campus:delete', deleted[0]!.title);
    return reply.status(204).send();
  } catch (e) {
    return fail(request, reply, e);
  }
}
