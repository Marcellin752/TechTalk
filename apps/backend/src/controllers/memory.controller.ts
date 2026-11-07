import { FastifyReply, FastifyRequest } from 'fastify';
import { and, asc, eq, lte, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { userCards } from '../db/schema.js';
import { schedule, type Grade } from '../services/growth/sm2.js';
import { recordEvidence } from '../services/skills/store.js';
import { UUID_RE, body, fail, longText, text, userId } from './common.js';

const MAX_CARDS = 2000;
const view = (c: typeof userCards.$inferSelect) => ({ id: c.id, front: c.front, back: c.back, topic: c.topic, dueAt: c.dueAt, intervalDays: c.intervalDays, reps: c.reps, lapses: c.lapses });

/** The learner's own cards: the ones due now first, and the totals. */
export async function handleCards(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const q = (request.query ?? {}) as { all?: string };
    const now = new Date();
    const due = await db.select().from(userCards).where(and(eq(userCards.userId, uid), lte(userCards.dueAt, now))).orderBy(asc(userCards.dueAt)).limit(30);
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(userCards).where(eq(userCards.userId, uid));
    const all = q.all === '1' ? await db.select().from(userCards).where(eq(userCards.userId, uid)).orderBy(asc(userCards.dueAt)).limit(500) : undefined;
    return reply.status(200).send({ due: due.map(view), total, ...(all ? { all: all.map(view) } : {}) });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleCreateCard(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const b = body(request);
    const front = text(b.front, 2, 400);
    const back = longText(b.back, 1, 2000);
    const topic = b.topic == null || b.topic === '' ? null : text(b.topic, 1, 60)?.toLowerCase() ?? undefined;
    if (!front) return reply.status(400).send({ error: 'The question needs 2 to 400 characters.' });
    if (!back) return reply.status(400).send({ error: 'The answer needs 1 to 2000 characters.' });
    if (topic === undefined) return reply.status(400).send({ error: 'The topic is too long.' });
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(userCards).where(eq(userCards.userId, uid));
    if (n >= MAX_CARDS) return reply.status(409).send({ error: 'You have reached the limit of cards.' });
    const [row] = await db.insert(userCards).values({ userId: uid, front, back, topic }).returning();
    return reply.status(201).send({ card: view(row!) });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleUpdateCard(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid card.' });
    const b = body(request);
    const patch: Partial<typeof userCards.$inferInsert> = {};
    if (b.front !== undefined) { const v = text(b.front, 2, 400); if (!v) return reply.status(400).send({ error: 'The question needs 2 to 400 characters.' }); patch.front = v; }
    if (b.back !== undefined) { const v = longText(b.back, 1, 2000); if (!v) return reply.status(400).send({ error: 'The answer needs 1 to 2000 characters.' }); patch.back = v; }
    if (b.topic !== undefined) { patch.topic = b.topic === null || b.topic === '' ? null : text(b.topic, 1, 60)?.toLowerCase() ?? null; }
    if (Object.keys(patch).length === 0) return reply.status(400).send({ error: 'Nothing to change.' });
    const [row] = await db.update(userCards).set(patch).where(and(eq(userCards.id, id), eq(userCards.userId, uid))).returning();
    if (!row) return reply.status(404).send({ error: 'Card not found.' });
    return reply.status(200).send({ card: view(row) });
  } catch (e) {
    return fail(request, reply, e);
  }
}

export async function handleDeleteCard(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as { id?: string };
    if (!id || !UUID_RE.test(id)) return reply.status(400).send({ error: 'Invalid card.' });
    const gone = await db.delete(userCards).where(and(eq(userCards.id, id), eq(userCards.userId, userId(request)))).returning({ id: userCards.id });
    return gone.length ? reply.status(204).send() : reply.status(404).send({ error: 'Card not found.' });
  } catch (e) {
    return fail(request, reply, e);
  }
}

/** The learner says how it went: 0 forgot, 1 hard, 2 good, 3 easy. A card with a topic that is recalled counts as evidence for it. */
export async function handleGradeCard(request: FastifyRequest, reply: FastifyReply) {
  try {
    const uid = userId(request);
    const { id } = request.params as { id?: string };
    const grade = Number(body(request).grade);
    if (!id || !UUID_RE.test(id) || ![0, 1, 2, 3].includes(grade)) return reply.status(400).send({ error: 'Grade must be 0, 1, 2 or 3.' });
    const [card] = await db.select().from(userCards).where(and(eq(userCards.id, id), eq(userCards.userId, uid))).limit(1);
    if (!card) return reply.status(404).send({ error: 'Card not found.' });
    const now = new Date();
    // A card that is not due yet cannot be farmed for evidence by grading it repeatedly.
    const wasDue = card.dueAt <= now;
    const next = schedule(card, grade as Grade, now);
    await db.update(userCards).set({ ease: next.ease, intervalDays: next.intervalDays, reps: next.reps, lapses: next.lapses, dueAt: next.dueAt, lastAt: now }).where(eq(userCards.id, id));
    // Self-graded, so only a long-held card counts, and lightly: the learner marking their own answers is not proof of much.
    if (card.topic && wasDue && grade >= 2 && card.intervalDays >= 6) await recordEvidence(uid, [{ topic: card.topic, type: 'review', outcome: 0.8, ref: `card:${id}:${next.reps}` }]).catch((e) => request.log.warn(e));
    return reply.status(200).send({ nextDueAt: next.dueAt, intervalDays: next.intervalDays });
  } catch (e) {
    return fail(request, reply, e);
  }
}
