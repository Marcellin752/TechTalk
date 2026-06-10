import { FastifyInstance } from 'fastify';
import { handleGetArticles, handleCreateArticle } from '../controllers/articles.controller.js';

export async function articlesRoutes(fastify: FastifyInstance) {
  
  // Protect all routes inside this file with the JWT authentication hook
  fastify.addHook('preHandler', (fastify as any).authenticate);

  // GET /api/articles -> Fetch all tech posts
  fastify.get('/', handleGetArticles);

  // POST /api/articles -> Manually insert a tech post
  fastify.post('/', handleCreateArticle);
}
