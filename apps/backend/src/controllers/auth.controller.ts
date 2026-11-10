import { FastifyRequest, FastifyReply } from 'fastify';
import bcrypt from 'bcrypt';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
import { db } from '../db/db.js';
import { users } from '../db/schema.js';
import { config } from '../config/env.js';
import { syncGithubProfileInBackground } from '../services/github-profile.js';
import { issueSession, revokeRefreshToken, rotateRefreshToken } from '../services/session.js';
import { validateEmail, validatePassword } from '../utils/validators.js';

export async function handleRegister(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email, password, name } = request.body as any;

    if (!email || !password || !name) {
      return reply.status(400).send({ error: 'All fields (email, password, name) are required.' });
    }

    if (!validateEmail(email)) {
      return reply.status(400).send({ error: 'Invalid email format.' });
    }

    if (!validatePassword(password)) {
      return reply.status(400).send({ 
        error: 'Password must be between 12 and 100 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.' 
      });
    }

    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      return reply.status(409).send({ error: 'A user with this email already exists.' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const insertedRows = await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
      role: 'user',
    }).returning();

    const createdUser = insertedRows[0];

    if (!createdUser) {
      throw new Error('Failed to retrieve created user from database.');
    }

    return reply.status(201).send({ 
      message: 'User registered successfully!',
      user: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        role: createdUser.role,
        picture: createdUser.picture ?? null
      } 
    });

  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleLogin(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({ error: 'Email and password are required.' });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }

    // Google-only accounts have no password set; reject password login for them
    if (!user.password) {
      return reply.status(401).send({ error: 'This account uses Google Sign-In. Please use Continue with Google.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return reply.status(401).send({ error: 'Invalid email or password.' });
    }

    const { token, refreshToken } = await issueSession(request.server as any, user, config.jwtExpiresIn, request.headers['user-agent']);

    return reply.status(200).send({ 
      message: 'Login successful!',
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        picture: user.picture ?? null
      }
    });

  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleGoogleAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { credential } = request.body as { credential?: string };

    if (!credential) {
      return reply.status(400).send({ error: 'Missing Google credential token.' });
    }

    const clientId = config.googleClientId;
    if (!clientId) {
      return reply.status(503).send({ error: 'Google Sign-In is not configured on the server.' });
    }

    const client = new OAuth2Client(clientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      request.log.error(err);
      return reply.status(401).send({ error: 'Invalid Google credential.' });
    }

    if (!payload || !payload.email || !payload.email_verified) {
      return reply.status(401).send({ error: 'Google account email is not verified.' });
    }

    const googleId = payload.sub as string;
    const email = payload.email;
    const name = payload.name || email.split('@')[0];
    const picture = payload.picture || null;

    // Find an existing user by googleId OR by email
    const existingByGoogle = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    const existingByEmail = existingByGoogle.length === 0
      ? await db.select().from(users).where(eq(users.email, email)).limit(1)
      : [];

    let user;
    if (existingByGoogle[0]) {
      // Already linked: refresh the avatar if Google re-sends one
      if (picture && existingByGoogle[0].picture !== picture) {
        const [updated] = await db.update(users)
          .set({ picture })
          .where(eq(users.id, existingByGoogle[0].id))
          .returning();
        user = updated;
      } else {
        user = existingByGoogle[0];
      }
    } else if (existingByEmail[0]) {
      // Link googleId to an existing email/password account
      const [updated] = await db.update(users)
        .set({ googleId, ...(picture ? { picture } : {}) })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();
      user = updated;
    } else {
      // Create a brand new Google-only account
      const [created] = await db.insert(users).values({
        name,
        email,
        password: null,
        googleId,
        picture,
        role: 'user',
      }).returning();
      user = created;
    }

    if (!user) {
      throw new Error('Failed to resolve Google user.');
    }

    const { token, refreshToken } = await issueSession(request.server as any, user, config.jwtExpiresIn, request.headers['user-agent']);

    return reply.status(200).send({
      message: 'Google Sign-In successful!',
      token,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        picture: user.picture ?? null,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleUpdateProfile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as any).id;
    const { name } = request.body as { name?: string };

    if (!name || !name.trim()) {
      return reply.status(400).send({ error: 'Name is required.' });
    }
    if (name.trim().length > 100) {
      return reply.status(400).send({ error: 'Name must be 100 characters or fewer.' });
    }

    const [updated] = await db.update(users)
      .set({ name: name.trim() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      return reply.status(404).send({ error: 'User not found.' });
    }

    return reply.status(200).send({
      message: 'Profile updated successfully!',
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        picture: updated.picture ?? null,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleRefresh(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { refreshToken } = (request.body ?? {}) as { refreshToken?: unknown };
    if (typeof refreshToken !== 'string' || refreshToken.length < 20 || refreshToken.length > 200) {
      return reply.status(401).send({ error: 'Missing refresh token.' });
    }
    const result = await rotateRefreshToken(request.server as any, refreshToken, config.jwtExpiresIn, request.headers['user-agent']);
    if (!result.ok) {
      return reply.status(401).send({
        error: result.reason === 'expired' ? 'Session expired. Please sign in again.' : 'Invalid session. Please sign in again.',
      });
    }
    const { user } = result;
    return reply.status(200).send({
      message: 'Token refreshed successfully!',
      token: result.token,
      refreshToken: result.refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, picture: user.picture ?? null },
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/** Signs this device out for good: its refresh token stops working. */
export async function handleLogout(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { refreshToken } = (request.body ?? {}) as { refreshToken?: unknown };
    if (typeof refreshToken === 'string' && refreshToken.length <= 200) await revokeRefreshToken(refreshToken);
    return reply.status(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleGetMe(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as any).id;

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return reply.status(404).send({ error: 'User not found.' });
    }

    return reply.status(200).send({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        picture: user.picture ?? null,
      },
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

// OAuth endpoints live on github.com; the REST API (profile, emails) lives on api.github.com.
const GITHUB_API = 'https://github.com';
const GITHUB_REST = 'https://api.github.com';

/** The exact callback URL GitHub must be told to redirect back to. Derived from
 *  the incoming request so one codebase works on localhost and behind a proxy. */
function githubRedirectUri(request: FastifyRequest): string {
  const proto = (request.headers['x-forwarded-proto'] as string) || (config.nodeEnv === 'production' ? 'https' : 'http');
  const host = (request.headers['x-forwarded-host'] as string) || request.host;
  return `${proto}://${host}/api/auth/github/callback`;
}

// CSRF: the state is a signed, expiring token echoed back by GitHub; no cookie
// plugin is required to verify it came from this server. It may carry the id of
// an already signed-in user, which turns the round trip into "link this GitHub
// account to me" instead of "sign me in".
const STATE_TTL_MS = 10 * 60 * 1000;
function signState(payload: string): string {
  return createHmac('sha256', config.jwtSecret).update(payload).digest('hex');
}
export function makeGithubState(linkUserId?: string): string {
  const payload = `${randomBytes(16).toString('hex')}.${linkUserId ?? '-'}.${Date.now()}`;
  return `${payload}.${signState(payload)}`;
}
function parseGithubState(state: string | undefined): { ok: boolean; linkUserId?: string } {
  if (!state) return { ok: false };
  const parts = state.split('.');
  if (parts.length !== 4) return { ok: false };
  const [nonce, uid, ts, signature] = parts as [string, string, string, string];
  const payload = `${nonce}.${uid}.${ts}`;
  try {
    const expected = Buffer.from(signState(payload));
    const given = Buffer.from(signature);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false };
  } catch {
    return { ok: false };
  }
  if (!Number.isFinite(Number(ts)) || Date.now() - Number(ts) > STATE_TTL_MS) return { ok: false };
  return { ok: true, linkUserId: uid === '-' ? undefined : uid };
}

/** The GitHub consent URL; `linkUserId` makes the round trip a link, not a login. */
export function githubAuthorizeUrl(request: FastifyRequest, clientId: string, linkUserId?: string): string {
  const url = new URL(`${GITHUB_API}/login/oauth/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', githubRedirectUri(request));
  url.searchParams.set('scope', 'read:user user:email');
  url.searchParams.set('state', makeGithubState(linkUserId));
  return url.toString();
}

/**
 * §49 OAuth (GitHub): start the redirect. Unconfigured installs bounce back to
 * the login screen with a flag so the button can show a friendly message rather
 * than a raw error page.
 */
export async function handleGithubStart(request: FastifyRequest, reply: FastifyReply) {
  try {
    if (!config.githubClientId || !config.githubClientSecret) {
      return reply.redirect(`${config.corsOrigin}/login#gh_unavailable=1`);
    }
    return reply.redirect(githubAuthorizeUrl(request, config.githubClientId));
  } catch (error) {
    request.log.error(error);
    return reply.redirect(`${config.corsOrigin}/login#gh_error=server`);
  }
}

/**
 * §49 OAuth (GitHub): the code GitHub hands back is exchanged server-side (the
 * client secret never reaches the browser), the GitHub profile is normalised
 * into our single users row, and the resulting JWT travels back to the SPA in
 * the URL fragment — which is never sent to any server or logged in a Referer.
 */
export async function handleGithubCallback(request: FastifyRequest, reply: FastifyReply) {
  const frontend = config.corsOrigin;
  const fail = (reason: string, detail?: unknown) => {
    request.log.warn({ reason, detail }, 'github_oauth_fail');
    return reply.redirect(`${frontend}/login#gh_error=${reason}`);
  };
  try {
    const { code, state, error } = request.query as { code?: string; state?: string; error?: string };
    if (error) return fail(error === 'access_denied' ? 'cancelled' : 'provider', error);
    const parsedState = parseGithubState(state);
    if (!code || !parsedState.ok) return fail('state', { hasCode: !!code });
    if (!config.githubClientId || !config.githubClientSecret) return fail('unconfigured');

    const tokenRes = await fetch(`${GITHUB_API}/login/oauth/access_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        client_id: config.githubClientId,
        client_secret: config.githubClientSecret,
        code,
        redirect_uri: githubRedirectUri(request),
      }),
    });
    const tokenJson: any = await tokenRes.json().catch(() => ({}));
    const accessToken = tokenJson?.access_token;
    if (!accessToken) return fail('token', { status: tokenRes.status, body: tokenJson });

    const ghHeaders = {
      authorization: `Bearer ${accessToken}`,
      'user-agent': 'TechTalk',
      accept: 'application/vnd.github+json',
    };

    const userRes = await fetch(`${GITHUB_REST}/user`, { headers: ghHeaders });
    if (!userRes.ok) {
      const body = await userRes.text().catch(() => '');
      return fail('profile', { status: userRes.status, body });
    }
    const ghUser: any = await userRes.json();
    if (!ghUser?.id) return fail('profile', ghUser);

    let email: string | null = typeof ghUser.email === 'string' && ghUser.email ? ghUser.email : null;
    if (!email) {
      const emailsRes = await fetch(`${GITHUB_REST}/user/emails`, { headers: ghHeaders });
      if (emailsRes.ok) {
        const emails: any[] = await emailsRes.json().catch(() => []);
        const verified = emails.filter((e) => e?.verified);
        email = verified.find((e) => e.primary)?.email || verified[0]?.email || null;
      }
    }
    // A stable, collision-free stand-in when GitHub exposes no email at all.
    if (!email) email = `${ghUser.id}+${ghUser.login}@users.noreply.github.com`;

    const githubId = String(ghUser.id);
    const name = ghUser.name || ghUser.login || email.split('@')[0];
    const picture = ghUser.avatar_url || null;

    // Link mode: attach this GitHub identity to the signed-in account.
    if (parsedState.linkUserId) {
      const back = (query: string) => reply.redirect(`${frontend}/profile#${query}`);
      const [owner] = await db.select().from(users).where(eq(users.githubId, githubId)).limit(1);
      if (owner && owner.id !== parsedState.linkUserId) return back('link_error=taken');
      if (!owner) {
        const [me] = await db.select().from(users).where(eq(users.id, parsedState.linkUserId)).limit(1);
        if (!me) return back('link_error=state');
        await db
          .update(users)
          .set({ githubId, ...(picture && !me.picture ? { picture } : {}) })
          .where(eq(users.id, me.id));
      }
      syncGithubProfileInBackground(parsedState.linkUserId, ghUser.login);
      return back('link=github');
    }

    const existingByGithub = await db.select().from(users).where(eq(users.githubId, githubId)).limit(1);
    let user;
    if (existingByGithub[0]) {
      user = existingByGithub[0];
      if (picture && user.picture !== picture) {
        const [updated] = await db.update(users).set({ picture }).where(eq(users.id, user.id)).returning();
        if (updated) user = updated;
      }
    } else {
      const existingByEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingByEmail[0]) {
        // Link GitHub to an account that already exists (password or Google).
        const [updated] = await db
          .update(users)
          .set({ githubId, ...(picture && !existingByEmail[0].picture ? { picture } : {}) })
          .where(eq(users.id, existingByEmail[0].id))
          .returning();
        user = updated ?? existingByEmail[0];
      } else {
        const [created] = await db
          .insert(users)
          .values({ name, email, password: null, githubId, picture, role: 'user' })
          .returning();
        user = created;
      }
    }
    if (!user) return fail('persist', { githubId, email });
    syncGithubProfileInBackground(user.id, ghUser.login);

    const { token, refreshToken } = await issueSession(request.server as any, user, config.jwtExpiresIn, request.headers['user-agent']);
    return reply.redirect(`${frontend}/login#gh_token=${encodeURIComponent(token)}&gh_refresh=${encodeURIComponent(refreshToken)}`);
  } catch (error) {
    request.log.error(error);
    return fail('server');
  }
}
