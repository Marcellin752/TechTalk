import { FastifyRequest, FastifyReply } from 'fastify';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { comments, contents, users } from '../db/schema.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_COMMENT_LENGTH = 1000;

const authorShape = { id: users.id, name: users.name, picture: users.picture };

/** Newest first, with the author's public fields only (never the email). */
export async function handleListComments(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { contentId } = request.params as { contentId?: string };
    if (!contentId || !UUID_RE.test(contentId)) return reply.status(400).send({ error: 'Invalid content id.' });
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(Math.max(parseInt(query.limit || '30', 10) || 30, 1), 100);
    const offset = Math.max(parseInt(query.offset || '0', 10) || 0, 0);

    const rows = await db
      .select({ id: comments.id, body: comments.body, createdAt: comments.createdAt, author: authorShape })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.userId))
      .where(eq(comments.contentId, contentId))
      .orderBy(desc(comments.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(comments)
      .where(eq(comments.contentId, contentId));

    return reply.status(200).send({ comments: rows, total });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

export async function handleCreateComment(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { contentId } = request.params as { contentId?: string };
    if (!contentId || !UUID_RE.test(contentId)) return reply.status(400).send({ error: 'Invalid content id.' });
    const body = String(((request.body ?? {}) as { body?: unknown }).body ?? '').trim();
    if (!body) return reply.status(400).send({ error: 'Write something first.' });
    if (body.length > MAX_COMMENT_LENGTH) {
      return reply.status(400).send({ error: `Comments are limited to ${MAX_COMMENT_LENGTH} characters.` });
    }

    const [content] = await db.select({ id: contents.id }).from(contents).where(eq(contents.id, contentId)).limit(1);
    if (!content) return reply.status(404).send({ error: 'Content not found.' });

    const userId = (request.user as { id: string }).id;
    const [created] = await db.insert(comments).values({ contentId, userId, body }).returning();
    const [author] = await db.select(authorShape).from(users).where(eq(users.id, userId)).limit(1);
    return reply.status(201).send({ id: created!.id, body: created!.body, createdAt: created!.createdAt, author });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}

/** Authors delete their own comments; admins can delete any. */
export async function handleDeleteComment(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { commentId } = request.params as { commentId?: string };
    if (!commentId || !UUID_RE.test(commentId)) return reply.status(400).send({ error: 'Invalid comment id.' });
    const { id: userId, role } = request.user as { id: string; role?: string };

    const [comment] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!comment) return reply.status(404).send({ error: 'Comment not found.' });
    if (comment.userId !== userId && role !== 'admin') return reply.status(403).send({ error: 'You can only delete your own comments.' });

    await db.delete(comments).where(and(eq(comments.id, commentId)));
    return reply.status(204).send();
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
  }
}
