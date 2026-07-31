import { FastifyRequest, FastifyReply } from 'fastify';
import { desc } from 'drizzle-orm';
import { db } from '../db/db.js';
import { contents } from '../db/schema.js';

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
