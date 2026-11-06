import { FastifyRequest, FastifyReply } from 'fastify';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/db.js';
import { githubProfiles, users, contents, readingHistory, learningSteps } from '../db/schema.js';
import { syncGithubProfile } from '../services/github-profile.js';

const SYNC_COOLDOWN_MS = 5 * 60 * 1000;

function present(profile: typeof githubProfiles.$inferSelect | null) {
  if (!profile) return null;
  const { userId: _omit, ...rest } = profile;
  return rest;
}

async function isLinked(userId: string): Promise<boolean> {
  const [u] = await db.select({ githubId: users.githubId }).from(users).where(eq(users.id, userId)).limit(1);
  return !!u?.githubId;
}

/** The developer profile: the stored snapshot, imported on first view if needed. */
export async function handleGetGithubProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as { id: string }).id;
    if (!(await isLinked(userId))) return reply.status(200).send({ linked: false, profile: null });

    let [profile] = await db.select().from(githubProfiles).where(eq(githubProfiles.userId, userId)).limit(1);
    let error: string | null = null;
    if (!profile) {
      try {
        profile = (await syncGithubProfile(userId)) ?? undefined!;
      } catch (err) {
        error = (err as Error).message;
      }
    }
    return reply.status(200).send({ linked: true, profile: present(profile ?? null), error });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/** Re-imports the repositories. Throttled so the button cannot hammer GitHub. */
export async function handleSyncGithubProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as { id: string }).id;
    if (!(await isLinked(userId))) return reply.status(409).send({ error: 'Link your GitHub account first.' });

    const [current] = await db.select().from(githubProfiles).where(eq(githubProfiles.userId, userId)).limit(1);
    if (current && Date.now() - new Date(current.syncedAt).getTime() < SYNC_COOLDOWN_MS) {
      return reply.status(200).send({ linked: true, profile: present(current), throttled: true });
    }
    try {
      const profile = await syncGithubProfile(userId);
      return reply.status(200).send({ linked: true, profile: present(profile), throttled: false });
    } catch (err) {
      return reply.status(502).send({ error: (err as Error).message });
    }
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

type Activity = { kind: 'read' | 'step'; at: Date; content: { id: string; type: string; title: string; source: string; url: string; image: string | null } };

/** Recent activity: what the learner opened and which path steps they finished, newest first. */
export async function handleGetHistory(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = (request.user as { id: string }).id;
    const limit = Math.min(Math.max(parseInt((request.query as { limit?: string }).limit || '60', 10) || 60, 1), 200);
    const shape = { id: contents.id, type: contents.type, title: contents.title, source: contents.source, url: contents.url, image: contents.image };

    const reads = await db
      .select({ at: readingHistory.readAt, content: shape })
      .from(readingHistory)
      .innerJoin(contents, eq(contents.id, readingHistory.contentId))
      .where(eq(readingHistory.userId, uid))
      .orderBy(desc(readingHistory.readAt))
      .limit(limit);
    const steps = await db
      .select({ at: learningSteps.completedAt, content: shape })
      .from(learningSteps)
      .innerJoin(contents, eq(contents.id, learningSteps.contentId))
      .where(and(eq(learningSteps.userId, uid), eq(learningSteps.status, 'done')))
      .orderBy(desc(learningSteps.completedAt))
      .limit(limit);

    const items: Activity[] = [
      ...reads.map((r) => ({ kind: 'read' as const, at: r.at, content: r.content })),
      ...steps.filter((s) => s.at).map((s) => ({ kind: 'step' as const, at: s.at as Date, content: s.content })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, limit);
    return reply.status(200).send({ items });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/** Forgets what was opened. Finished path steps are progress, not history, and stay. */
export async function handleClearHistory(request: FastifyRequest, reply: FastifyReply) {
  try {
    await db.delete(readingHistory).where(eq(readingHistory.userId, (request.user as { id: string }).id));
    return reply.status(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}
