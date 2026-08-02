import { FastifyRequest, FastifyReply } from 'fastify';
import { desc, eq, and } from 'drizzle-orm';
import { db } from '../db/db.js';
import { contents, bookmarks } from '../db/schema.js';

// Fetch all multi-platform contents, paginated and sorted by recency
export async function handleGetContents(request: FastifyRequest, reply: FastifyReply) {
  try {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(Math.max(parseInt(query.limit || '50', 10) || 50, 1), 100);
    const offset = Math.max(parseInt(query.offset || '0', 10) || 0, 0);

    const allContents = await db
      .select()
      .from(contents)
      .orderBy(desc(contents.createdAt))
      .limit(limit)
      .offset(offset);

    return reply.status(200).send(allContents);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching content.' });
  }
}

// Manually insert or scrape new content (Protected Route)
export async function handleCreateContent(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { title, url, source, type, summary, embedCode } = request.body as any;

    if (!title || !url || !source || !type) {
      return reply.status(400).send({ error: 'Fields (title, url, source, type) are required.' });
    }

    // Validate that the content type is known
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
      embedCode, // Storing the dynamic player data for YouTube/TikTok
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

// Fetch all bookmarks for authenticated user
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

// Bookmark a content item for authenticated user
export async function handleCreateBookmark(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request.user as any).id;
    const { contentId } = request.body as { contentId: string };

    if (!contentId) {
      return reply.status(400).send({ error: 'Field (contentId) is required.' });
    }

    // Check if the content exists
    const [content] = await db.select().from(contents).where(eq(contents.id, contentId)).limit(1);
    if (!content) {
      return reply.status(404).send({ error: 'Content not found.' });
    }

    // Insert bookmark
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

// Delete a bookmark for authenticated user
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
