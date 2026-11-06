import { describe, it, expect, vi, beforeEach } from 'vitest';

const queue = vi.hoisted(() => ({ results: [] as unknown[], inserted: [] as unknown[], deleted: 0 }));
vi.mock('../db/db.js', () => {
  const chain: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(queue.results.shift() ?? []);
      if (prop === 'values') return (v: unknown) => (queue.inserted.push(v), chain);
      if (prop === 'delete') return () => ((queue.deleted += 1), chain);
      return () => chain;
    },
    apply: () => chain,
  });
  return { db: chain };
});

import { handleListComments, handleCreateComment, handleDeleteComment, MAX_COMMENT_LENGTH } from './comment.controller.js';

const CONTENT = '2f1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const ME = '7a1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const OTHER = '9b1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
const COMMENT = '3c1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';

function reply() {
  const r: any = { statusCode: 200, body: undefined };
  r.status = (c: number) => ((r.statusCode = c), r);
  r.send = (b?: unknown) => ((r.body = b), r);
  return r;
}
const req = (extra: Record<string, unknown> = {}) =>
  ({ user: { id: ME, role: 'user' }, params: {}, query: {}, body: {}, log: { error: vi.fn() }, ...extra }) as any;

beforeEach(() => {
  queue.results = [];
  queue.inserted = [];
  queue.deleted = 0;
});

describe('list', () => {
  it('rejects a malformed content id', async () => {
    const r = reply();
    await handleListComments(req({ params: { contentId: 'nope' } }), r);
    expect(r.statusCode).toBe(400);
  });

  it('returns comments with a total', async () => {
    queue.results = [[{ id: COMMENT, body: 'hi', createdAt: new Date(), author: { id: ME, name: 'A', picture: null } }], [{ total: 1 }]];
    const r = reply();
    await handleListComments(req({ params: { contentId: CONTENT } }), r);
    expect(r.statusCode).toBe(200);
    expect(r.body.total).toBe(1);
    expect(r.body.comments[0].author).not.toHaveProperty('email');
  });
});

describe('create', () => {
  it('rejects empty and oversized comments before touching the db', async () => {
    let r = reply();
    await handleCreateComment(req({ params: { contentId: CONTENT }, body: { body: '   ' } }), r);
    expect(r.statusCode).toBe(400);
    r = reply();
    await handleCreateComment(req({ params: { contentId: CONTENT }, body: { body: 'x'.repeat(MAX_COMMENT_LENGTH + 1) } }), r);
    expect(r.statusCode).toBe(400);
    expect(queue.inserted).toHaveLength(0);
  });

  it('404s on unknown content', async () => {
    queue.results = [[]];
    const r = reply();
    await handleCreateComment(req({ params: { contentId: CONTENT }, body: { body: 'hello' } }), r);
    expect(r.statusCode).toBe(404);
  });

  it('stores a trimmed comment and returns it with its author', async () => {
    queue.results = [[{ id: CONTENT }], [{ id: COMMENT, body: 'hello', createdAt: new Date() }], [{ id: ME, name: 'A', picture: null }]];
    const r = reply();
    await handleCreateComment(req({ params: { contentId: CONTENT }, body: { body: '  hello  ' } }), r);
    expect(r.statusCode).toBe(201);
    expect(queue.inserted[0]).toEqual({ contentId: CONTENT, userId: ME, body: 'hello' });
    expect(r.body.author.name).toBe('A');
  });
});

describe('delete', () => {
  it("refuses to delete someone else's comment", async () => {
    queue.results = [[{ id: COMMENT, userId: OTHER }]];
    const r = reply();
    await handleDeleteComment(req({ params: { commentId: COMMENT } }), r);
    expect(r.statusCode).toBe(403);
    expect(queue.deleted).toBe(0);
  });

  it('lets authors and admins delete', async () => {
    queue.results = [[{ id: COMMENT, userId: ME }], []];
    let r = reply();
    await handleDeleteComment(req({ params: { commentId: COMMENT } }), r);
    expect(r.statusCode).toBe(204);
    queue.results = [[{ id: COMMENT, userId: OTHER }], []];
    r = reply();
    await handleDeleteComment(req({ user: { id: ME, role: 'admin' }, params: { commentId: COMMENT } }), r);
    expect(r.statusCode).toBe(204);
    expect(queue.deleted).toBe(2);
  });
});
