import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module BEFORE importing the controller
const mocks = vi.hoisted(() => ({
  selectFn: vi.fn(),
  fromFn: vi.fn(),
  orderByFn: vi.fn(),
  whereFn: vi.fn(),
  limitFn: vi.fn(),
  offsetFn: vi.fn(),
  insertFn: vi.fn(),
  valuesFn: vi.fn(),
}));

vi.mock('../db/db.js', () => ({
  db: {
    select: mocks.selectFn,
    insert: mocks.insertFn,
  },
}));

import { handleGetContents, handleMarkRead, handleMarkReadBatch, handleGetReading } from './content.controller.js';

function buildChain() {
  mocks.offsetFn.mockResolvedValue([{ id: '1', title: 'TypeScript Guide' }]);
  mocks.limitFn.mockReturnValue({ offset: mocks.offsetFn });
  mocks.orderByFn.mockReturnValue({ limit: mocks.limitFn });
  mocks.whereFn.mockReturnValue({ orderBy: mocks.orderByFn });
  mocks.fromFn.mockReturnValue({ orderBy: mocks.orderByFn, where: mocks.whereFn });
  mocks.selectFn.mockReturnValue({ from: mocks.fromFn });
}

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

describe('handleGetContents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildChain();
  });

  it('should fetch contents without a search filter by default', async () => {
    const reply = makeReply();
    const request: any = { query: {}, log: { error: vi.fn() } };

    await handleGetContents(request, reply);

    expect(reply.statusCode).toBe(200);
    expect(Array.isArray(reply.body)).toBe(true);
    expect(mocks.whereFn).not.toHaveBeenCalled();
    expect(mocks.limitFn).toHaveBeenCalled();
    expect(mocks.offsetFn).toHaveBeenCalled();
  });

  it('should apply a search filter when the search query is provided', async () => {
    const reply = makeReply();
    const request: any = { query: { search: 'typescript' }, log: { error: vi.fn() } };

    await handleGetContents(request, reply);

    expect(reply.statusCode).toBe(200);
    expect(mocks.whereFn).toHaveBeenCalledTimes(1);
    expect(mocks.limitFn).toHaveBeenCalled();
    expect(mocks.offsetFn).toHaveBeenCalled();
  });

  it('should apply a type filter when the type query is provided', async () => {
    const reply = makeReply();
    const request: any = { query: { type: 'video' }, log: { error: vi.fn() } };

    await handleGetContents(request, reply);

    expect(reply.statusCode).toBe(200);
    expect(mocks.whereFn).toHaveBeenCalledTimes(1);
    expect(mocks.limitFn).toHaveBeenCalled();
    expect(mocks.offsetFn).toHaveBeenCalled();
  });

  it('should apply a categories filter when categories are provided', async () => {
    const reply = makeReply();
    const request: any = { query: { categories: 'AI & ML,DevOps' }, log: { error: vi.fn() } };

    await handleGetContents(request, reply);

    expect(reply.statusCode).toBe(200);
    expect(mocks.whereFn).toHaveBeenCalledTimes(1);
    expect(mocks.limitFn).toHaveBeenCalled();
    expect(mocks.offsetFn).toHaveBeenCalled();
  });

  it('should clamp limit and offset to safe values', async () => {
    const reply = makeReply();
    const request: any = { query: { limit: '9999', offset: '-5' }, log: { error: vi.fn() } };

    await handleGetContents(request, reply);

    expect(reply.statusCode).toBe(200);
    expect(mocks.limitFn).toHaveBeenCalledWith(100); // clamped to max
    expect(mocks.offsetFn).toHaveBeenCalled(); // negative offset clamped to 0
  });
});

describe('reading history', () => {
  function makeUserRequest(body?: any) {
    return { user: { id: 'u-1' }, body: body ?? {}, log: { error: vi.fn() } };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reject marking a read without a contentId', async () => {
    const reply = makeReply();

    await handleMarkRead(makeUserRequest() as any, reply);

    expect(reply.statusCode).toBe(400);
    expect(reply.body.error).toContain('contentId');
  });

  it('should return 404 when marking a read for a missing content', async () => {
    mocks.limitFn.mockResolvedValueOnce([]);
    mocks.whereFn.mockReturnValue({ limit: mocks.limitFn });
    mocks.fromFn.mockReturnValue({ where: mocks.whereFn });
    mocks.selectFn.mockReturnValue({ from: mocks.fromFn });
    const reply = makeReply();

    await handleMarkRead(makeUserRequest({ contentId: 'c-missing' }) as any, reply);

    expect(reply.statusCode).toBe(404);
    expect(reply.body.error).toContain('Content not found');
  });

  it('should record a read for an existing content', async () => {
    mocks.limitFn.mockResolvedValueOnce([{ id: 'c-1' }]);
    mocks.whereFn.mockReturnValue({ limit: mocks.limitFn });
    mocks.fromFn.mockReturnValue({ where: mocks.whereFn });
    mocks.selectFn.mockReturnValue({ from: mocks.fromFn });
    mocks.valuesFn.mockReturnValue({});
    mocks.insertFn.mockReturnValue({ values: mocks.valuesFn });
    const reply = makeReply();

    await handleMarkRead(makeUserRequest({ contentId: 'c-1' }) as any, reply);

    expect(reply.statusCode).toBe(201);
    expect(mocks.insertFn).toHaveBeenCalled();
    expect(mocks.valuesFn).toHaveBeenCalledWith({ userId: 'u-1', contentId: 'c-1' });
  });

  it('should reject an empty batch upload', async () => {
    const reply = makeReply();

    await handleMarkReadBatch(makeUserRequest({ contentIds: [] }) as any, reply);

    expect(reply.statusCode).toBe(400);
    expect(reply.body.error).toContain('contentIds');
  });

  it('should upload only valid, not-yet-read contents', async () => {
    // First query: already-read ids for this user → empty
    mocks.whereFn.mockResolvedValueOnce([]);
    // Second query: valid contents among the submitted ids
    mocks.whereFn.mockResolvedValueOnce([{ id: 'c-1' }, { id: 'c-2' }]);
    mocks.fromFn.mockReturnValue({ where: mocks.whereFn });
    mocks.selectFn.mockReturnValue({ from: mocks.fromFn });
    mocks.valuesFn.mockReturnValue({});
    mocks.insertFn.mockReturnValue({ values: mocks.valuesFn });
    const reply = makeReply();

    await handleMarkReadBatch(makeUserRequest({ contentIds: ['c-1', 'c-2', 'c-ghost'] }) as any, reply);

    expect(reply.statusCode).toBe(200);
    expect(mocks.valuesFn).toHaveBeenCalledWith([
      { userId: 'u-1', contentId: 'c-1' },
      { userId: 'u-1', contentId: 'c-2' },
    ]);
  });

  it('should aggregate read ids and distinct read dates', async () => {
    mocks.orderByFn.mockResolvedValueOnce([
      { contentId: 'c-1', readAt: new Date('2026-08-10T12:00:00Z') },
      { contentId: 'c-2', readAt: new Date('2026-08-09T12:00:00Z') },
      { contentId: 'c-1', readAt: new Date('2026-08-10T18:00:00Z') },
    ]);
    mocks.whereFn.mockReturnValue({ orderBy: mocks.orderByFn });
    mocks.fromFn.mockReturnValue({ where: mocks.whereFn });
    mocks.selectFn.mockReturnValue({ from: mocks.fromFn });
    const reply = makeReply();

    await handleGetReading(makeUserRequest() as any, reply);

    expect(reply.statusCode).toBe(200);
    expect(reply.body.readIds).toEqual(['c-1', 'c-2']);
    expect(reply.body.readDates).toEqual(['2026-08-10', '2026-08-09']);
  });
});
