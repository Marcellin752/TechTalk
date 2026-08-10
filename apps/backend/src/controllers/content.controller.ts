import { FastifyRequest, FastifyReply } from 'fastify';
import { desc, eq, and, ilike, or, arrayOverlaps, inArray } from 'drizzle-orm';
import { db } from '../db/db.js';
import { contents, bookmarks, readingHistory } from '../db/schema.js';
import { classifyContent } from '../utils/classify.js';

export async function handleGetContents(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = request.query as { limit?: string; offset?: string; search?: string; type?: string; categories?: string };
    const limit = Math.min(Math.max(parseInt(query.limit || '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(query.offset || '0', 10) || 0, 0);

    const search = (query.search || '').trim();
    const type = (query.type || '').trim().toLowerCase();
    const categories = (query.categories || '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const conditions = [];
    if (search) {
      conditions.push(or(
        ilike(contents.title, `%${search}%`),
        ilike(contents.summary, `%${search}%`),
        ilike(contents.source, `%${search}%`)
      ));
    }
    if (type) {
      conditions.push(eq(contents.type, type));
    }
    if (categories.length > 0) {
      conditions.push(arrayOverlaps(contents.categories, categories));
    }

    const filtered = conditions.length > 0
      ? db.select().from(contents).where(and(...conditions))
      : db.select().from(contents);

    const allContents = await filtered.orderBy(desc(contents.createdAt)).limit(limit).offset(offset);

    return reply.status(200).send(allContents);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching content.' });
  }
}

export async function handleCreateContent(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { title, url, source, type, summary, embedCode } = request.body as any;

    if (!title || !url || !source || !type) {
      return reply.status(400).send({ error: 'Fields (title, url, source, type) are required.' });
    }

    const validTypes = ['article', 'video', 'social_post'];
    if (!validTypes.includes(type)) {
      return reply.status(400).send({ error: 'Invalid content type. Must be article, video, or social_post.' });
    }

    const [newContent] = await db.insert(contents).values({
      title,
      url,
      source,
      type,
      summary,
      categories: classifyContent(title, summary),
    }).returning();

    return reply.status(201).send({
      message: 'Content aggregated successfully!',
      content: newContent
    });
  } catch (error) {
    request.log.error(error);
    if ((error as any).code === '23505') {
      return reply.status(409).send({ error: 'This resource link has already been aggregated.' });
    }
    return reply.status(500).send({ error: 'Internal server error while creating content.' });
  }
}

export async function handleGetBookmarks(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as any).id;
    const userBookmarks = await db
      .select({
        id: contents.id,
        title: contents.title,
        url: contents.url,
        source: contents.source,
        type: contents.type,
        summary: contents.summary,
        body: contents.body,
        categories: contents.categories,
        image: contents.image,
        embedCode: contents.embedCode,
        createdAt: contents.createdAt,
      })
      .from(bookmarks)
      .innerJoin(contents, eq(bookmarks.contentId, contents.id))
      .where(eq(bookmarks.userId, userId))
      .orderBy(desc(bookmarks.createdAt));

    return reply.status(200).send(userBookmarks);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching bookmarks.' });
  }
}

export async function handleCreateBookmark(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as any).id;
    const { contentId } = request.body as { contentId: string };

    if (!contentId) {
      return reply.status(400).send({ error: 'Field (contentId) is required.' });
    }

    const [content] = await db.select().from(contents).where(eq(contents.id, contentId)).limit(1);
    if (!content) {
      return reply.status(404).send({ error: 'Content not found.' });
    }

    await db.insert(bookmarks).values({
      userId,
      contentId,
    }).onConflictDoNothing();

    return reply.status(201).send({ message: 'Content bookmarked successfully!' });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while creating bookmark.' });
  }
}

export async function handleDeleteBookmark(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as any).id;
    const { contentId } = request.params as { contentId: string };

    if (!contentId) {
      return reply.status(400).send({ error: 'Parameter contentId is required.' });
    }

    await db.delete(bookmarks).where(
      and(
        eq(bookmarks.userId, userId),
        eq(bookmarks.contentId, contentId)
      )
    );

    return reply.status(200).send({ message: 'Bookmark removed successfully!' });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while removing bookmark.' });
  }
}

export async function handleMarkRead(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as any).id;
    const { contentId } = request.body as { contentId?: string };

    if (!contentId) {
      return reply.status(400).send({ error: 'Field (contentId) is required.' });
    }

    const [content] = await db.select().from(contents).where(eq(contents.id, contentId)).limit(1);
    if (!content) {
      return reply.status(404).send({ error: 'Content not found.' });
    }

    await db.insert(readingHistory).values({ userId, contentId });
    return reply.status(201).send({ message: 'Reading recorded successfully!' });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while recording read.' });
  }
}

export async function handleMarkReadBatch(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as any).id;
    const { contentIds } = request.body as { contentIds?: string[] };

    const ids = (contentIds || []).filter((id) => typeof id === 'string' && id.length > 0);
    if (ids.length === 0) {
      return reply.status(400).send({ error: 'Field (contentIds) is required.' });
    }

    const alreadyRead = await db
      .select({ contentId: readingHistory.contentId })
      .from(readingHistory)
      .where(and(eq(readingHistory.userId, userId), inArray(readingHistory.contentId, ids)));
    const alreadyReadSet = new Set(alreadyRead.map((r) => r.contentId));

    const validContents = await db.select({ id: contents.id }).from(contents).where(inArray(contents.id, ids));
    const validSet = new Set(validContents.map((c) => c.id));

    const toInsert = ids.filter((id) => validSet.has(id) && !alreadyReadSet.has(id));
    if (toInsert.length > 0) {
      await db.insert(readingHistory).values(toInsert.map((contentId) => ({ userId, contentId })));
    }

    return reply.status(200).send({ message: 'Reading history synced successfully!' });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while syncing reads.' });
  }
}

export async function handleGetReading(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as any).id;

    const history = await db
      .select()
      .from(readingHistory)
      .where(eq(readingHistory.userId, userId))
      .orderBy(desc(readingHistory.readAt));

    const readIds = Array.from(new Set(history.map((h) => h.contentId)));
    const readDates = Array.from(new Set(history.map((h) => new Date(h.readAt).toISOString().slice(0, 10))));

    return reply.status(200).send({ readIds, readDates });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching reading history.' });
  }
}
