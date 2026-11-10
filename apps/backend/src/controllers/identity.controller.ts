import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
import { revokeAllRefreshTokens } from '../services/session.js';
import { db } from '../db/db.js';
import { users } from '../db/schema.js';
import { config } from '../config/env.js';
import { validatePassword } from '../utils/validators.js';
import { githubAuthorizeUrl } from './auth.controller.js';

/* One person, one account, several ways in: e-mail + password, Google and
   GitHub can all be attached to the same user. The rule that keeps this safe is
   simple: an account must always keep at least one way to sign in. */


function currentUserId(request: FastifyRequest): string {
  return (request.user as { id: string }).id;
}

async function loadUser(id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
}

function describe(user: NonNullable<Awaited<ReturnType<typeof loadUser>>>) {
  return {
    email: user.email,
    hasPassword: !!user.password,
    google: !!user.googleId,
    github: !!user.githubId,
  };
}

function signInMethods(user: NonNullable<Awaited<ReturnType<typeof loadUser>>>): number {
  return [user.password, user.googleId, user.githubId].filter(Boolean).length;
}

export async function handleGetIdentities(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = await loadUser(currentUserId(request));
    if (!user) return reply.status(404).send({ error: 'User not found.' });
    return reply.status(200).send(describe(user));
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/** Attach a Google identity to the signed-in account (verified id token). */
export async function handleLinkGoogle(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { credential } = (request.body ?? {}) as { credential?: string };
    if (!credential) return reply.status(400).send({ error: 'Missing Google credential token.' });
    if (!config.googleClientId) return reply.status(503).send({ error: 'Google Sign-In is not configured on the server.' });

    let payload;
    try {
      const ticket = await new OAuth2Client(config.googleClientId).verifyIdToken({
        idToken: credential,
        audience: config.googleClientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      request.log.error(err);
      return reply.status(401).send({ error: 'Invalid Google credential.' });
    }
    if (!payload?.sub) return reply.status(401).send({ error: 'Invalid Google credential.' });

    const userId = currentUserId(request);
    const googleId = payload.sub;
    const [owner] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    if (owner && owner.id !== userId) {
      return reply.status(409).send({ error: 'This Google account is already linked to another TechTalk account.' });
    }
    const me = await loadUser(userId);
    if (!me) return reply.status(404).send({ error: 'User not found.' });

    if (!owner) {
      await db
        .update(users)
        .set({ googleId, ...(payload.picture && !me.picture ? { picture: payload.picture } : {}) })
        .where(eq(users.id, userId));
    }
    const fresh = await loadUser(userId);
    return reply.status(200).send(describe(fresh!));
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/** Returns the GitHub consent URL for a link round trip (a redirect cannot carry
 *  the Authorization header, so the signed-in user is bound into `state`). */
export async function handleLinkGithubStart(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (!config.githubClientId || !config.githubClientSecret) {
      return reply.status(503).send({ error: 'GitHub sign-in is not configured on the server.' });
    }
    return reply.status(200).send({ url: githubAuthorizeUrl(request, config.githubClientId, currentUserId(request)) });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleUnlink(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { provider } = request.params as { provider?: string };
    if (provider !== 'google' && provider !== 'github') {
      return reply.status(400).send({ error: 'Unknown provider.' });
    }
    const user = await loadUser(currentUserId(request));
    if (!user) return reply.status(404).send({ error: 'User not found.' });

    const column = provider === 'google' ? 'googleId' : 'githubId';
    if (!user[column]) return reply.status(409).send({ error: 'This account is not linked.' });
    if (signInMethods(user) <= 1) {
      return reply.status(409).send({
        error: 'This is your only way to sign in. Add a password or another account before unlinking it.',
      });
    }
    await db.update(users).set({ [column]: null }).where(eq(users.id, user.id));
    const fresh = await loadUser(user.id);
    return reply.status(200).send(describe(fresh!));
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/** Set a password on an account that has none (Google/GitHub-only), or change
 *  it, which then requires the current one. */
export async function handleSetPassword(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { currentPassword, newPassword } = (request.body ?? {}) as { currentPassword?: string; newPassword?: string };
    if (!validatePassword(newPassword ?? '')) {
      return reply.status(400).send({
        error:
          'Password must be between 12 and 100 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.',
      });
    }
    const user = await loadUser(currentUserId(request));
    if (!user) return reply.status(404).send({ error: 'User not found.' });

    if (user.password) {
      const ok = typeof currentPassword === 'string' && (await bcrypt.compare(currentPassword, user.password));
      if (!ok) return reply.status(403).send({ error: 'Current password is incorrect.' });
    }
    const hash = await bcrypt.hash(newPassword as string, 10);
    await db.update(users).set({ password: hash }).where(eq(users.id, user.id));
    // A new password signs every other device out.
    await revokeAllRefreshTokens(user.id);
    const fresh = await loadUser(user.id);
    return reply.status(200).send(describe(fresh!));
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

