import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/env.js', () => ({
  config: {
    googleClientId: 'cid.apps.googleusercontent.com',
    githubClientId: 'gh-id',
    githubClientSecret: 'gh-secret',
    jwtSecret: 'test-secret',
    nodeEnv: 'test',
  },
}));

const verifyIdToken = vi.fn();
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(function () {
    return { verifyIdToken };
  }),
}));

// Queue-driven fake db: every awaited query chain resolves to the next result.
const queue = vi.hoisted(() => ({ results: [] as unknown[], updates: [] as unknown[] }));
vi.mock('../services/session.js', () => ({ revokeAllRefreshTokens: vi.fn() }));

vi.mock('../db/db.js', () => {
  const chain: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(queue.results.shift() ?? []);
      if (prop === 'set') return (v: unknown) => (queue.updates.push(v), chain);
      return () => chain;
    },
    apply: () => chain,
  });
  return { db: chain };
});

import {
  handleGetIdentities,
  handleLinkGoogle,
  handleLinkGithubStart,
  handleUnlink,
  handleSetPassword,
} from './identity.controller.js';

const ME = '7a1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const OTHER = '9b1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const STRONG = 'Str0ng!Passw0rd#1';

function reply() {
  const r: any = { statusCode: 200, body: null };
  r.status = (c: number) => ((r.statusCode = c), r);
  r.send = (b: unknown) => ((r.body = b), r);
  return r;
}
const req = (extra: Record<string, unknown> = {}) =>
  ({ user: { id: ME }, body: {}, params: {}, headers: {}, host: 'localhost:5001', log: { error: vi.fn(), warn: vi.fn() }, ...extra }) as any;
const row = (over: Record<string, unknown> = {}) => ({ id: ME, email: 'a@b.co', password: null, googleId: null, githubId: null, picture: null, ...over });

beforeEach(() => {
  queue.results = [];
  queue.updates = [];
  verifyIdToken.mockReset();
});

describe('identities', () => {
  it('reports which sign-in methods are attached', async () => {
    queue.results = [[row({ password: 'h', githubId: '42' })]];
    const r = reply();
    await handleGetIdentities(req(), r);
    expect(r.body).toEqual({ email: 'a@b.co', hasPassword: true, google: false, github: true });
  });
});

describe('link google', () => {
  it('refuses a Google account that belongs to someone else', async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'g1', email: 'x@y.z' }) });
    queue.results = [[row({ id: OTHER, googleId: 'g1' })]];
    const r = reply();
    await handleLinkGoogle(req({ body: { credential: 'tok' } }), r);
    expect(r.statusCode).toBe(409);
    expect(queue.updates).toHaveLength(0);
  });

  it('attaches the Google id and keeps an existing avatar', async () => {
    verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'g1', picture: 'p.png' }) });
    // owner lookup, me, (update), fresh row
    queue.results = [[], [row({ picture: 'mine.png' })], [], [row({ googleId: 'g1', picture: 'mine.png' })]];
    const r = reply();
    await handleLinkGoogle(req({ body: { credential: 'tok' } }), r);
    expect(r.statusCode).toBe(200);
    expect(queue.updates[0]).toEqual({ googleId: 'g1' });
    expect(r.body.google).toBe(true);
  });

  it('rejects an invalid credential', async () => {
    verifyIdToken.mockRejectedValue(new Error('bad'));
    const r = reply();
    await handleLinkGoogle(req({ body: { credential: 'tok' } }), r);
    expect(r.statusCode).toBe(401);
  });
});

describe('link github', () => {
  it('returns a consent URL whose state is bound to the signed-in user', async () => {
    const r = reply();
    await handleLinkGithubStart(req(), r);
    const url = new URL(r.body.url);
    expect(url.hostname).toBe('github.com');
    expect(url.searchParams.get('state')!.split('.')[1]).toBe(ME);
  });
});

describe('unlink', () => {
  it('refuses to remove the only way to sign in', async () => {
    queue.results = [[row({ googleId: 'g1' })]];
    const r = reply();
    await handleUnlink(req({ params: { provider: 'google' } }), r);
    expect(r.statusCode).toBe(409);
    expect(queue.updates).toHaveLength(0);
  });

  it('unlinks when another method remains', async () => {
    queue.results = [[row({ googleId: 'g1', password: 'h' })], [], [row({ password: 'h' })]];
    const r = reply();
    await handleUnlink(req({ params: { provider: 'google' } }), r);
    expect(r.statusCode).toBe(200);
    expect(queue.updates[0]).toEqual({ googleId: null });
  });

  it('rejects an unknown provider and an unlinked one', async () => {
    let r = reply();
    await handleUnlink(req({ params: { provider: 'facebook' } }), r);
    expect(r.statusCode).toBe(400);
    queue.results = [[row({ password: 'h' })]];
    r = reply();
    await handleUnlink(req({ params: { provider: 'github' } }), r);
    expect(r.statusCode).toBe(409);
  });
});

describe('password', () => {
  it('lets an OAuth-only account add a password without a current one', async () => {
    queue.results = [[row({ googleId: 'g1' })], [], [row({ googleId: 'g1', password: 'h' })]];
    const r = reply();
    await handleSetPassword(req({ body: { newPassword: STRONG } }), r);
    expect(r.statusCode).toBe(200);
    expect(r.body.hasPassword).toBe(true);
  });

  it('requires the current password to change an existing one', async () => {
    queue.results = [[row({ password: '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid' })]];
    const r = reply();
    await handleSetPassword(req({ body: { newPassword: STRONG, currentPassword: 'nope' } }), r);
    expect(r.statusCode).toBe(403);
  });

  it('rejects a weak password before touching the db', async () => {
    const r = reply();
    await handleSetPassword(req({ body: { newPassword: 'short' } }), r);
    expect(r.statusCode).toBe(400);
  });
});
