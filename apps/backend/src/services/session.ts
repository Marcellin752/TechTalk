import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { db } from '../db/db.js';
import { refreshTokens, users } from '../db/schema.js';

/** How long a sign-in lasts without the person coming back. */
export const REFRESH_TTL_DAYS = 30;
/** Two tabs refreshing at once is normal; a token reused later than this is not. */
export const REUSE_GRACE_MS = 15_000;

type SessionUser = { id: string; email: string; role: string };
type Signer = { jwt: { sign: (payload: object, options?: object) => string } };

export const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

/** Short-lived access token. */
export function signAccessToken(app: Signer, user: SessionUser, expiresIn: string): string {
  return app.jwt.sign({ id: user.id, email: user.email, role: user.role }, { expiresIn });
}

async function insertRefreshToken(userId: string, familyId: string, userAgent?: string): Promise<string> {
  const raw = randomBytes(48).toString('base64url');
  await db.insert(refreshTokens).values({
    userId,
    familyId,
    tokenHash: hashToken(raw),
    userAgent: userAgent?.slice(0, 200) ?? null,
    expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000),
  });
  return raw;
}

/** A new sign-in: an access token plus the first refresh token of a new family. */
export async function issueSession(app: Signer, user: SessionUser, expiresIn: string, userAgent?: string) {
  const refreshToken = await insertRefreshToken(user.id, randomUUID(), userAgent);
  return { token: signAccessToken(app, user, expiresIn), refreshToken };
}

export type RotateResult =
  | { ok: true; user: typeof users.$inferSelect; token: string; refreshToken: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'reused' };

/**
 * Trades a refresh token for a new pair. The old token is spent. If a spent token
 * comes back after the grace window, someone kept a copy: the whole family is revoked.
 */
export async function rotateRefreshToken(app: Signer, raw: string, expiresIn: string, userAgent?: string): Promise<RotateResult> {
  const [row] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, hashToken(raw))).limit(1);
  if (!row) return { ok: false, reason: 'invalid' };

  if (row.revokedAt) {
    if (Date.now() - row.revokedAt.getTime() > REUSE_GRACE_MS) {
      await db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.familyId, row.familyId), isNull(refreshTokens.revokedAt)));
      return { ok: false, reason: 'reused' };
    }
    return { ok: false, reason: 'invalid' };
  }
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: 'expired' };

  const [user] = await db.select().from(users).where(eq(users.id, row.userId)).limit(1);
  if (!user) return { ok: false, reason: 'invalid' };

  // Claim the old token atomically: only one of two racing requests wins.
  const claimed = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.id, row.id), isNull(refreshTokens.revokedAt)))
    .returning({ id: refreshTokens.id });
  if (claimed.length === 0) return { ok: false, reason: 'invalid' };

  const refreshToken = await insertRefreshToken(user.id, row.familyId, userAgent);
  return { ok: true, user, token: signAccessToken(app, user, expiresIn), refreshToken };
}

/** Sign out of this device. */
export async function revokeRefreshToken(raw: string): Promise<void> {
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.tokenHash, hashToken(raw)), isNull(refreshTokens.revokedAt)));
}

/** Sign out everywhere (password change, account deletion). */
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

/** Housekeeping: spent and expired rows are no use to anyone. */
export async function purgeRefreshTokens(): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 86_400_000);
  await db.delete(refreshTokens).where(or(lt(refreshTokens.expiresAt, new Date()), lt(refreshTokens.revokedAt, cutoff)));
}

export const activeSessionsFilter = (userId: string) => and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt), gt(refreshTokens.expiresAt, new Date()));
