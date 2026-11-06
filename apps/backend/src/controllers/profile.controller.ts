import { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/db.js';
import { githubProfiles, users } from '../db/schema.js';
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
