import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config BEFORE importing the controller
vi.mock('../config/env.js', () => ({
  config: {
    googleClientId: 'mock-client-id.apps.googleusercontent.com',
    jwtSecret: 'test-secret',
    jwtExpiresIn: '1d',
  },
}));

// Mock the Google auth library
const verifyIdTokenMock = vi.fn();
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(function () {
    return { verifyIdToken: verifyIdTokenMock };
  }),
}));

// Mock the database module
const mocks = vi.hoisted(() => ({
  selectFn: vi.fn(),
  fromFn: vi.fn(),
  whereFn: vi.fn(),
  limitFn: vi.fn(),
  updateFn: vi.fn(),
  setFn: vi.fn(),
  returningFn: vi.fn(),
  insertFn: vi.fn(),
  valuesFn: vi.fn(),
}));

vi.mock('../db/db.js', () => ({
  db: {
    select: mocks.selectFn,
    update: mocks.updateFn,
    insert: mocks.insertFn,
  },
}));

const session = vi.hoisted(() => ({
  issueSession: vi.fn(async (app: any) => ({ token: app.jwt.sign({}), refreshToken: 'refresh-token' })),
  rotateRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeAllRefreshTokens: vi.fn(),
}));
vi.mock('../services/session.js', () => session);

import { handleGoogleAuth, handleGetMe, handleRefresh, handleLogout } from './auth.controller.js';

function makeReply() {
  const reply: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(payload: unknown) {
      reply.body = payload;
      return reply;
    },
  };
  return reply;
}

function makeRequest() {
  return {
    body: { credential: 'mock-google-credential' },
    headers: { 'user-agent': 'vitest' },
    log: { error: vi.fn() },
    server: {
      jwt: {
        sign: vi.fn().mockReturnValue('signed-jwt-token'),
      },
    },
  };
}

describe('handleGoogleAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject a request without a credential', async () => {
    const reply = makeReply();
    const request: any = { body: {}, log: { error: vi.fn() } };

    await handleGoogleAuth(request, reply);

    expect(reply.statusCode).toBe(400);
    expect(reply.body.error).toContain('credential');
  });

  it('should return 503 when GOOGLE_CLIENT_ID is not configured', async () => {
    const { config } = await import('../config/env.js');
    (config as any).googleClientId = undefined;
    const reply = makeReply();

    await handleGoogleAuth(makeRequest() as any, reply);

    expect(reply.statusCode).toBe(503);
    (config as any).googleClientId = 'mock-client-id.apps.googleusercontent.com';
  });

  it('should reject an invalid Google token', async () => {
    verifyIdTokenMock.mockRejectedValueOnce(new Error('Token signature invalid'));
    const reply = makeReply();

    await handleGoogleAuth(makeRequest() as any, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body.error).toContain('Invalid Google credential');
  });

  it('should reject an unverified email', async () => {
    verifyIdTokenMock.mockResolvedValueOnce({
      getPayload: () => ({ sub: 'google-123', email: 'alex@example.com', email_verified: false }),
    });
    mocks.limitFn.mockResolvedValue([]);
    mocks.whereFn.mockReturnValue({ limit: mocks.limitFn });
    mocks.fromFn.mockReturnValue({ where: mocks.whereFn });
    mocks.selectFn.mockReturnValue({ from: mocks.fromFn });
    const reply = makeReply();

    await handleGoogleAuth(makeRequest() as any, reply);

    expect(reply.statusCode).toBe(401);
    expect(reply.body.error).toContain('not verified');
  });

  it('should create a new user and sign a JWT', async () => {
    const payload = { sub: 'google-123', email: 'alex@example.com', email_verified: true, name: 'Alex Kim' };
    verifyIdTokenMock.mockResolvedValueOnce({ getPayload: () => payload });

    // First lookup by googleId: no match
    mocks.limitFn.mockResolvedValueOnce([]);
    // Second lookup by email: no match
    mocks.limitFn.mockResolvedValueOnce([]);
    mocks.whereFn.mockReturnValue({ limit: mocks.limitFn });
    mocks.fromFn.mockReturnValue({ where: mocks.whereFn });
    mocks.selectFn.mockReturnValue({ from: mocks.fromFn });

    // Insert returns the created user
    mocks.valuesFn.mockReturnValue({
      returning: mocks.returningFn.mockResolvedValueOnce([
        { id: 'u-1', name: 'Alex Kim', email: 'alex@example.com', role: 'user' },
      ]),
    });
    mocks.insertFn.mockReturnValue({ values: mocks.valuesFn });

    const reply = makeReply();
    const request: any = makeRequest();

    await handleGoogleAuth(request, reply);

    expect(reply.statusCode).toBe(200);
    expect(reply.body.token).toBe('signed-jwt-token');
    expect(reply.body.user.email).toBe('alex@example.com');
    expect(mocks.insertFn).toHaveBeenCalled();
  });

  it('should link googleId to an existing email account', async () => {
    const payload = { sub: 'google-123', email: 'alex@example.com', email_verified: true };
    verifyIdTokenMock.mockResolvedValueOnce({ getPayload: () => payload });

    // First lookup by googleId: no match
    mocks.limitFn.mockResolvedValueOnce([]);
    // Second lookup by email: existing account found
    mocks.limitFn.mockResolvedValueOnce([
      { id: 'u-1', name: 'Alex Kim', email: 'alex@example.com', role: 'user' },
    ]);
    // Update returns the linked user
    mocks.returningFn.mockResolvedValueOnce([
      { id: 'u-1', name: 'Alex Kim', email: 'alex@example.com', role: 'user' },
    ]);
    mocks.whereFn.mockReturnValue({ limit: mocks.limitFn, returning: mocks.returningFn });
    mocks.fromFn.mockReturnValue({ where: mocks.whereFn });
    mocks.selectFn.mockReturnValue({ from: mocks.fromFn });
    mocks.setFn.mockReturnValue({ where: mocks.whereFn });
    mocks.updateFn.mockReturnValue({ set: mocks.setFn });

    const reply = makeReply();

    await handleGoogleAuth(makeRequest() as any, reply);

    expect(reply.statusCode).toBe(200);
    expect(mocks.updateFn).toHaveBeenCalled();
    expect(mocks.setFn).toHaveBeenCalledWith({ googleId: 'google-123' });
  });

  it('should sign in an existing Google user without touching the DB beyond lookup', async () => {
    const payload = { sub: 'google-123', email: 'alex@example.com', email_verified: true };
    verifyIdTokenMock.mockResolvedValueOnce({ getPayload: () => payload });

    // First lookup by googleId: found
    mocks.limitFn.mockResolvedValueOnce([
      { id: 'u-1', name: 'Alex Kim', email: 'alex@example.com', role: 'user' },
    ]);
    mocks.whereFn.mockReturnValue({ limit: mocks.limitFn });
    mocks.fromFn.mockReturnValue({ where: mocks.whereFn });
    mocks.selectFn.mockReturnValue({ from: mocks.fromFn });

    const reply = makeReply();

    await handleGoogleAuth(makeRequest() as any, reply);

    expect(reply.statusCode).toBe(200);
    expect(mocks.insertFn).not.toHaveBeenCalled();
    expect(mocks.updateFn).not.toHaveBeenCalled();
  });

  it('should return the authenticated user from /me', async () => {
    mocks.limitFn.mockResolvedValueOnce([
      { id: 'u-1', name: 'Alex Kim', email: 'alex@example.com', role: 'user', picture: null },
    ]);
    mocks.whereFn.mockReturnValue({ limit: mocks.limitFn });
    mocks.fromFn.mockReturnValue({ where: mocks.whereFn });
    mocks.selectFn.mockReturnValue({ from: mocks.fromFn });

    const reply = makeReply();
    const request: any = { user: { id: 'u-1' }, log: { error: vi.fn() } };

    await handleGetMe(request, reply);

    expect(reply.statusCode).toBe(200);
    expect(reply.body.user.email).toBe('alex@example.com');
    expect(reply.body.user.picture).toBeNull();
  });

  it('should return 404 from /me when the user no longer exists', async () => {
    mocks.limitFn.mockResolvedValueOnce([]);
    mocks.whereFn.mockReturnValue({ limit: mocks.limitFn });
    mocks.fromFn.mockReturnValue({ where: mocks.whereFn });
    mocks.selectFn.mockReturnValue({ from: mocks.fromFn });

    const reply = makeReply();
    const request: any = { user: { id: 'missing' }, log: { error: vi.fn() } };

    await handleGetMe(request, reply);

    expect(reply.statusCode).toBe(404);
    expect(reply.body.error).toBe('User not found.');
  });
});

describe('handleRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeReq = (body: unknown): any => ({ body, headers: { 'user-agent': 'vitest' }, log: { error: vi.fn() }, server: {} });
  const goodToken = 'a'.repeat(64);

  it('rejects a request without a refresh token', async () => {
    const reply = makeReply();
    await handleRefresh(makeReq({}), reply);
    expect(reply.statusCode).toBe(401);
    expect(reply.body.error).toContain('Missing refresh token');
    expect(session.rotateRefreshToken).not.toHaveBeenCalled();
  });

  it('rejects an unknown or spent refresh token', async () => {
    session.rotateRefreshToken.mockResolvedValueOnce({ ok: false, reason: 'reused' });
    const reply = makeReply();
    await handleRefresh(makeReq({ refreshToken: goodToken }), reply);
    expect(reply.statusCode).toBe(401);
    expect(reply.body.error).toContain('Invalid session');
  });

  it('tells the client when the session has run out', async () => {
    session.rotateRefreshToken.mockResolvedValueOnce({ ok: false, reason: 'expired' });
    const reply = makeReply();
    await handleRefresh(makeReq({ refreshToken: goodToken }), reply);
    expect(reply.statusCode).toBe(401);
    expect(reply.body.error).toContain('Session expired');
  });

  it('hands back a new pair and the user, without the password hash', async () => {
    session.rotateRefreshToken.mockResolvedValueOnce({
      ok: true,
      token: 'new-access',
      refreshToken: 'new-refresh',
      user: { id: 'u-1', name: 'Alex Kim', email: 'alex@example.com', role: 'user', picture: null, password: 'hash' },
    });
    const reply = makeReply();
    await handleRefresh(makeReq({ refreshToken: goodToken }), reply);
    expect(reply.statusCode).toBe(200);
    expect(reply.body.token).toBe('new-access');
    expect(reply.body.refreshToken).toBe('new-refresh');
    expect(reply.body.user).toEqual({ id: 'u-1', name: 'Alex Kim', email: 'alex@example.com', role: 'user', picture: null });
  });
});

describe('handleLogout', () => {
  it('revokes the refresh token and answers 204', async () => {
    const reply = makeReply();
    await handleLogout({ body: { refreshToken: 'x'.repeat(40) }, log: { error: vi.fn() } } as any, reply);
    expect(session.revokeRefreshToken).toHaveBeenCalledWith('x'.repeat(40));
    expect(reply.statusCode).toBe(204);
  });
});
