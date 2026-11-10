import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/env.js', () => ({ config: { siteUrl: 'https://site.test' } }));
const queue = vi.hoisted(() => ({ results: [] as unknown[], writes: [] as unknown[], failWrite: false }));
vi.mock('../db/db.js', () => {
  const chain: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(queue.results.shift() ?? []);
      if (prop === 'values') return (v: unknown) => (queue.writes.push(v), chain);
      if (prop === 'onConflictDoUpdate') return () => {
        if (queue.failWrite) throw new Error('duplicate key value violates unique constraint');
        return chain;
      };
      return () => chain;
    },
    apply: () => chain,
  });
  return { db: chain };
});

import { handleSaveSettings, handleGetPublicProfile } from './public-profile.controller.js';

function reply() {
  const r: any = { statusCode: 200, body: undefined, headers: {} };
  r.status = (c: number) => ((r.statusCode = c), r);
  r.send = (b?: unknown) => ((r.body = b), r);
  r.header = (k: string, v: string) => ((r.headers[k] = v), r);
  return r;
}
const req = (body: unknown = {}, params: Record<string, string> = {}) => ({ user: { id: 'u1' }, body, params, query: {}, log: { error: vi.fn() } }) as any;

beforeEach(() => {
  queue.results = [];
  queue.writes = [];
  queue.failWrite = false;
});

describe('saving the settings', () => {
  it('rejects an invalid or reserved handle before touching the database', async () => {
    let r = reply();
    await handleSaveSettings(req({ handle: 'a' }), r);
    expect(r.statusCode).toBe(400);
    r = reply();
    await handleSaveSettings(req({ handle: 'admin' }), r);
    expect(r.statusCode).toBe(400);
    expect(queue.writes).toHaveLength(0);
  });

  it('refuses to go public without a handle', async () => {
    queue.results = [[]]; // no existing settings
    const r = reply();
    await handleSaveSettings(req({ isPublic: true }), r);
    expect(r.statusCode).toBe(400);
    expect(r.body.error).toMatch(/profile name/i);
  });

  it('rejects non-boolean switches and oversized interest lists', async () => {
    let r = reply();
    await handleSaveSettings(req({ pathPublic: 'yes' }), r);
    expect(r.statusCode).toBe(400);
    r = reply();
    await handleSaveSettings(req({ interests: Array.from({ length: 20 }, (_, i) => `t${i}`) }), r);
    expect(r.statusCode).toBe(400);
  });

  it('answers 409 when the name is taken', async () => {
    queue.results = [[]]; // no existing settings; the write then hits the unique constraint
    queue.failWrite = true;
    const r = reply();
    await handleSaveSettings(req({ handle: 'taken-name' }), r);
    expect(r.statusCode).toBe(409);
    expect(r.body.error).toMatch(/already taken/i);
  });
});

describe('public profile lookup', () => {
  it('answers the same 404 for a private or a missing profile', async () => {
    queue.results = [[]];
    const r = reply();
    await handleGetPublicProfile(req({}, { handle: 'ghost' }), r);
    expect(r.statusCode).toBe(404);
    expect(r.body).toEqual({ error: 'Profile not found.' });
  });
});
