import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../db/db.js';
import { articles } from '../db/schema.js';

// 1. Fetch all articles from the database
export async function handleGetArticles(request: FastifyRequest, reply: FastifyReply) {
  try {
    const allArticles = await db.select().from(articles);
    return reply.status(200).send(allArticles);
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ error: 'Internal server error while fetching articles.' });
  }
}

// 2. Create a new article manually (Protected Route)
export async function handleCreateArticle(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { title, url, source, summary } = request.body as any;

    // Validate required fields based on schema constraints
    if (!title || !url || !source) {
      return reply.status(400).send({ error: 'Fields (title, url, source) are required.' });
    }

    // Insert the new article into PostgreSQL using Drizzle ORM
    const [newArticle] = await db.insert(articles).values({
      title,
      url,
      source,
      summary,
    }).returning();

    return reply.status(201).send({
      message: 'Article created successfully!',
      article: newArticle
    });
  } catch (error) {
    request.log.error(error);
    
    // Handle database unique constraint violation for duplicate URLs
    if ((error as any).code === '23505') {
      return reply.status(409).send({ error: 'An article with this URL already exists.' });
    }
    
    return reply.status(500).send({ error: 'Internal server error while creating article.' });
  }
}
