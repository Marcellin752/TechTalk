import { FastifyRequest, FastifyReply } from 'fastify';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { contents, githubProfiles, learningPaths, learningSteps, profileSettings, users } from '../db/schema.js';
import { assemblePathView, type PathRow, type StepRow } from '../services/learning/view.js';
import { cleanDetail, cleanQuery, publicView, sitemapXml, suggestHandle, validateHandle, type DetailField, type Settings } from '../services/public-profile.js';
import { config } from '../config/env.js';

const userId = (r: FastifyRequest) => (r.user as { id: string }).id;

/** The owner's own settings, with a suggested handle when none is chosen yet. */
export async function handleGetSettings(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const [row] = await db.select().from(profileSettings).where(eq(profileSettings.userId, uid)).limit(1);
    const [user] = await db.select({ name: users.name, githubLogin: users.githubLogin }).from(users).where(eq(users.id, uid)).limit(1);
    return reply.status(200).send({
      settings: row
        ? { handle: row.handle, isPublic: row.isPublic, showProjects: row.showProjects, showInterests: row.showInterests, pathPublic: row.pathPublic, interests: row.interests, bio: row.bio, location: row.location, website: row.website, avatarUrl: row.avatarUrl }
        : { handle: null, isPublic: false, showProjects: true, showInterests: true, pathPublic: false, interests: [], bio: null, location: null, website: null, avatarUrl: null },
      suggestedHandle: suggestHandle(user?.githubLogin || user?.name || ''),
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

const BOOLS = ['isPublic', 'showProjects', 'showInterests', 'pathPublic'] as const;

/** Partial update: any of handle, the four switches, interests. Going public needs a handle. */
export async function handleSaveSettings(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const body = (request.body ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};

    if (body.handle !== undefined) {
      if (body.handle === null || body.handle === '') patch.handle = null;
      else {
        const v = validateHandle(body.handle);
        if (!v.ok) return reply.status(400).send({ error: v.error });
        patch.handle = v.handle;
      }
    }
    for (const key of BOOLS) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== 'boolean') return reply.status(400).send({ error: `${key} must be true or false.` });
        patch[key] = body[key];
      }
    }
    for (const field of ['bio', 'location', 'website', 'avatarUrl'] as DetailField[]) {
      if (body[field] !== undefined) {
        const c = cleanDetail(field, body[field]);
        if (!c.ok) return reply.status(400).send({ error: c.error });
        patch[field] = c.value;
      }
    }
    if (body.interests !== undefined) {
      if (!Array.isArray(body.interests) || body.interests.length > 12 || body.interests.some((i) => typeof i !== 'string' || i.length > 40)) {
        return reply.status(400).send({ error: 'Interests must be a list of up to 12 short names.' });
      }
      patch.interests = [...new Set((body.interests as string[]).map((i) => i.trim()).filter(Boolean))];
    }

    const [existing] = await db.select().from(profileSettings).where(eq(profileSettings.userId, uid)).limit(1);
    const finalHandle = (patch.handle !== undefined ? patch.handle : existing?.handle) as string | null | undefined;
    const finalPublic = (patch.isPublic !== undefined ? patch.isPublic : existing?.isPublic) as boolean | undefined;
    if (finalPublic && !finalHandle) return reply.status(400).send({ error: 'Choose a profile name before making your profile public.' });
    if (patch.handle === null && existing?.isPublic && patch.isPublic === undefined) patch.isPublic = false;

    try {
      await db.insert(profileSettings).values({ userId: uid, ...patch }).onConflictDoUpdate({ target: profileSettings.userId, set: { ...patch, updatedAt: new Date() } });
    } catch (err) {
      if (/unique|duplicate/i.test((err as Error).message)) return reply.status(409).send({ error: 'This profile name is already taken.' });
      throw err;
    }
    return handleGetSettings(request, reply);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/** Is this name free? Used while typing. */
export async function handleCheckHandle(request: FastifyRequest, reply: FastifyReply) {
  try {
    const v = validateHandle((request.query as { handle?: string }).handle);
    if (!v.ok) return reply.status(200).send({ available: false, reason: v.error });
    const [row] = await db.select({ userId: profileSettings.userId }).from(profileSettings).where(eq(profileSettings.handle, v.handle)).limit(1);
    const mine = row?.userId === userId(request);
    return reply.status(200).send({ available: !row || mine, reason: row && !mine ? 'This profile name is already taken.' : null });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

async function pathFor(uid: string) {
  const [path] = await db.select().from(learningPaths).where(and(eq(learningPaths.userId, uid), eq(learningPaths.active, true))).limit(1);
  if (!path) return null;
  const rows = await db
    .select({
      id: learningSteps.id, position: learningSteps.position, stage: learningSteps.stage, kind: learningSteps.kind, minutes: learningSteps.minutes, status: learningSteps.status, completedAt: learningSteps.completedAt,
      content: { id: contents.id, type: contents.type, title: contents.title, url: contents.url, source: contents.source, summary: sql<string | null>`null`, image: sql<string | null>`null`, meta: sql<null>`null` },
    })
    .from(learningSteps)
    .innerJoin(contents, eq(contents.id, learningSteps.contentId))
    .where(eq(learningSteps.pathId, path.id))
    .orderBy(asc(learningSteps.position));
  const v = assemblePathView(path as PathRow, rows as StepRow[]);
  return {
    title: v.title, goal: v.goal, level: v.level, hoursPerWeek: v.hoursPerWeek, percent: v.progress.percent, weeksTotal: v.progress.weeksTotal,
    stages: v.stages.map((s) => ({ index: s.index, title: s.title, objective: s.objective, done: s.done, total: s.total, steps: s.steps.map((x) => ({ kind: x.kind, minutes: x.minutes, status: x.status, content: x.content })) })),
  };
}

/** A public profile. A private or missing one answers the same 404: nothing to enumerate. */
export async function handleGetPublicProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const handle = String((request.params as { handle?: string }).handle ?? '').toLowerCase();
    const [row] = await db
      .select({ s: profileSettings, name: users.name, picture: users.picture })
      .from(profileSettings)
      .innerJoin(users, eq(users.id, profileSettings.userId))
      .where(and(eq(profileSettings.handle, handle), eq(profileSettings.isPublic, true)))
      .limit(1);
    if (!row) return reply.status(404).send({ error: 'Profile not found.' });

    const [gh] = await db.select().from(githubProfiles).where(eq(githubProfiles.userId, row.s.userId)).limit(1);
    const path = row.s.pathPublic ? await pathFor(row.s.userId) : null;
    const settings: Settings = { isPublic: true, showProjects: row.s.showProjects, showInterests: row.s.showInterests, pathPublic: row.s.pathPublic, interests: row.s.interests, bio: row.s.bio, location: row.s.location, website: row.s.website, avatarUrl: row.s.avatarUrl };
    return reply.status(200).send(publicView({ handle, name: row.name, picture: row.picture, github: gh ?? null, settings, path, updatedAt: row.s.updatedAt }));
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/** The directory: public profiles, newest activity first, searchable. */
export async function handleListPublicProfiles(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = request.query as { q?: string; limit?: string; offset?: string };
    const limit = Math.min(Math.max(parseInt(query.limit || '24', 10) || 24, 1), 48);
    const offset = Math.max(parseInt(query.offset || '0', 10) || 0, 0);
    const q = cleanQuery(query.q);
    const like = `%${q}%`;

    const rows = await db
      .select({ s: profileSettings, name: users.name, picture: users.picture, ghLanguages: githubProfiles.languages, ghAvatar: githubProfiles.avatarUrl })
      .from(profileSettings)
      .innerJoin(users, eq(users.id, profileSettings.userId))
      .leftJoin(githubProfiles, eq(githubProfiles.userId, profileSettings.userId))
      .where(and(
        eq(profileSettings.isPublic, true),
        q ? or(ilike(profileSettings.handle, like), ilike(users.name, like), sql`array_to_string(${profileSettings.interests}, ' ') ilike ${like}`, sql`${githubProfiles.languages}::text ilike ${like}`) : undefined,
      ))
      .orderBy(desc(profileSettings.updatedAt))
      .limit(limit)
      .offset(offset);

    const withPath = await Promise.all(
      rows.map(async (r) => {
        let goal: string | null = null;
        let percent: number | null = null;
        if (r.s.pathPublic) {
          const p = await pathFor(r.s.userId);
          goal = p?.goal ?? null;
          percent = p?.percent ?? null;
        }
        return {
          handle: r.s.handle, name: r.name, picture: r.picture ?? r.ghAvatar ?? null,
          languages: (r.ghLanguages ?? []).slice(0, 3).map((l) => l.name),
          interests: r.s.showInterests ? r.s.interests.slice(0, 4) : [],
          goal, percent,
        };
      }),
    );
    return reply.status(200).send({ profiles: withPath });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleSitemap(request: FastifyRequest, reply: FastifyReply) {
  try {
    const rows = await db
      .select({ handle: profileSettings.handle, updatedAt: profileSettings.updatedAt })
      .from(profileSettings)
      .where(and(eq(profileSettings.isPublic, true)))
      .orderBy(desc(profileSettings.updatedAt))
      .limit(5000);
    const handles = rows.filter((r): r is { handle: string; updatedAt: Date } => !!r.handle);
    return reply.header('content-type', 'application/xml; charset=utf-8').header('cache-control', 'public, max-age=3600').send(sitemapXml(config.siteUrl, handles));
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

