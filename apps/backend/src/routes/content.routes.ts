import { FastifyInstance } from 'fastify';
import { 
  handleGetContents, 
  handleCreateContent,
  handleGetBookmarks,
  handleCreateBookmark,
  handleDeleteBookmark
} from '../controllers/content.controller.js';

export async function contentRoutes(fastify: FastifyInstance) {
  // Publicly readable for authenticated users
  fastify.get('/', { preHandler: [fastify.authenticate] }, handleGetContents);

  // Protected: Only authenticated administrators can manually append content
  fastify.post('/', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, handleCreateContent);

  // Bookmarks routes
  fastify.get('/bookmarks', { preHandler: [fastify.authenticate] }, handleGetBookmarks);
  fastify.post('/bookmarks', { preHandler: [fastify.authenticate] }, handleCreateBookmark);
  fastify.delete('/bookmarks/:contentId', { preHandler: [fastify.authenticate] }, handleDeleteBookmark);
}
