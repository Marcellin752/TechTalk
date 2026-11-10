import { FastifyRequest, FastifyReply } from 'fastify';
import { desc, eq, and, ilike, or, arrayOverlaps, inArray, sql } from 'drizzle-orm';
import { db } from '../db/db.js';
import { contents, bookmarks, readingHistory } from '../db/schema.js';
import { classifyContent } from '../utils/classify.js';
import { loadRankSignals, rankContents, pickWildcards } from '../services/ranking.js';

/** How many recent items of one format are scored when building a personalised page. */
const FORYOU_POOL = 400;

export async function handleGetContents(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = request.query as { limit?: string; offset?: string; search?: string; type?: string; categories?: string; sort?: string; interests?: string; learn?: string; platform?: string; difficulty?: string; kind?: string };
    const limit = Math.min(Math.max(parseInt(query.limit || '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(query.offset || '0', 10) || 0, 0);

    const search = (query.search || '').trim();
    const type = (query.type || '').trim().toLowerCase();
    const categories = (query.categories || '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    const conditions = [];
    // Every word must match somewhere (name, description, source, category,
    // language/topics held in meta), so "react state" narrows as you type more.
    const terms = search.split(/\s+/).filter(Boolean).slice(0, 6);
    for (const term of terms) {
      const like = `%${term.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
      conditions.push(or(
        ilike(contents.title, like),
        ilike(contents.summary, like),
        ilike(contents.source, like),
        sql`array_to_string(${contents.categories}, ' ') ilike ${like}`,
        sql`${contents.meta}::text ilike ${like}`,
      ));
    }
    if (type) {
      conditions.push(eq(contents.type, type));
    }
    // Facts providers keep in `meta`: Learn and Practice pages narrow by these.
    if (query.learn === '1') conditions.push(sql`${contents.meta}->>'learn' = 'true'`);
    for (const key of ['platform', 'difficulty', 'kind'] as const) {
      const value = (query[key] || '').trim();
      if (value) conditions.push(sql`${contents.meta}->>${key} = ${value}`);
    }
    if (categories.length > 0) {
      conditions.push(arrayOverlaps(contents.categories, categories));
    }

    // "Something different": quality items from outside the learner's domains, to widen the feed.
    if (query.sort === 'wildcard') {
      // Videos qualify only if they are lectures; filter in SQL so the pool is not just the newest shorts.
      if (type === 'video') conditions.push(sql`${contents.meta}->>'learn' = 'true'`);
      const userId = (request.user as { id: string }).id;
      const interests = (query.interests || '').split(',').map((c) => c.trim()).filter(Boolean);
      const [signals, pool] = await Promise.all([
        loadRankSignals(userId, interests),
        (conditions.length > 0 ? db.select().from(contents).where(and(...conditions)) : db.select().from(contents))
          .orderBy(desc(contents.createdAt))
          .limit(FORYOU_POOL),
      ]);
      return reply.status(200).send(pickWildcards(pool, signals, Math.min(limit, 10)));
    }

    // Personalised ordering ("For you"): score a pool of recent items against what
    // we know about the user. A text search keeps its own relevance ordering.
    if (query.sort === 'foryou' && !search) {
      const userId = (request.user as { id: string }).id;
      const interests = (query.interests || '').split(',').map((c) => c.trim()).filter(Boolean);
      const [signals, pool] = await Promise.all([
        loadRankSignals(userId, interests),
        (conditions.length > 0 ? db.select().from(contents).where(and(...conditions)) : db.select().from(contents))
          .orderBy(desc(contents.createdAt))
          .limit(FORYOU_POOL),
      ]);
      return reply.status(200).send(rankContents(pool, signals).slice(offset, offset + limit));
    }

    const filtered = conditions.length > 0
      ? db.select().from(contents).where(and(...conditions))
      : db.select().from(contents);

    // Name matches first, then the newest.
    const order = search
      ? [sql`(${contents.title} ilike ${'%' + search + '%'}) desc`, desc(contents.createdAt)]
      : [desc(contents.createdAt)];
    const allContents = await filtered.orderBy(...order).limit(limit).offset(offset);

    return reply.status(200).send(allContents);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching content.' });
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One item by id, so a shared or reloaded link can open its own page. */
export async function handleGetContent(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { contentId } = request.params as { contentId?: string };
    if (!contentId || !UUID_RE.test(contentId)) return reply.status(400).send({ error: 'Invalid content id.' });
    const [content] = await db.select().from(contents).where(eq(contents.id, contentId)).limit(1);
    if (!content) return reply.status(404).send({ error: 'Content not found.' });
    return reply.status(200).send(content);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error.' });
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
