import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the database module BEFORE importing the controller
const mocks = vi.hoisted(() => ({
  selectFn: vi.fn(),
  fromFn: vi.fn(),
  orderByFn: vi.fn(),
  whereFn: vi.fn(),
  limitFn: vi.fn(),
  offsetFn: vi.fn(),
}));

vi.mock('../db/db.js', () => ({
  db: {
    select: mocks.selectFn,
  },
}));

import { handleGetContents } from './content.controller.js';

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
