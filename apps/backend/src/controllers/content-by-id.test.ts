import { describe, it, expect, vi, beforeEach } from 'vitest';

const queue = vi.hoisted(() => ({ results: [] as unknown[] }));
vi.mock('../db/db.js', () => {
  const chain: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(queue.results.shift() ?? []);
      return () => chain;
    },
    apply: () => chain,
  });
  return { db: chain };
});

import { handleGetContent } from './content.controller.js';

const ID = '2f1b3a4c-5d6e-4a7b-8c9d-0e1f2a3b4c5d';
function reply() {
  const r: any = { statusCode: 200, body: undefined };
  r.status = (c: number) => ((r.statusCode = c), r);
  r.send = (b?: unknown) => ((r.body = b), r);
  return r;
}
const req = (contentId: string) => ({ params: { contentId }, log: { error: vi.fn() } }) as any;

beforeEach(() => {
  queue.results = [];
});

describe('GET /content/:contentId', () => {
  it('rejects a malformed id', async () => {
    const r = reply();
    await handleGetContent(req('nope'), r);
    expect(r.statusCode).toBe(400);
  });

  it('404s when the item does not exist', async () => {
    queue.results = [[]];
    const r = reply();
    await handleGetContent(req(ID), r);
    expect(r.statusCode).toBe(404);
  });

  it('returns the item', async () => {
    queue.results = [[{ id: ID, title: 'T', type: 'video' }]];
    const r = reply();
    await handleGetContent(req(ID), r);
    expect(r.statusCode).toBe(200);
    expect(r.body.id).toBe(ID);
  });
});
