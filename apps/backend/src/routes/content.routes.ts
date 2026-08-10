import { FastifyInstance } from 'fastify';
import { 
  handleGetContents, 
  handleCreateContent,
  handleGetBookmarks,
  handleCreateBookmark,
  handleDeleteBookmark,
  handleMarkRead,
  handleMarkReadBatch,
  handleGetReading
} from '../controllers/content.controller.js';

export async function contentRoutes(fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [fastify.authenticate] }, handleGetContents);

  fastify.post('/', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, handleCreateContent);

  fastify.get('/bookmarks', { preHandler: [fastify.authenticate] }, handleGetBookmarks);
  fastify.post('/bookmarks', { preHandler: [fastify.authenticate] }, handleCreateBookmark);
  fastify.delete('/bookmarks/:contentId', { preHandler: [fastify.authenticate] }, handleDeleteBookmark);

  fastify.get('/read', { preHandler: [fastify.authenticate] }, handleGetReading);
  fastify.post('/read', { preHandler: [fastify.authenticate] }, handleMarkRead);
  fastify.post('/read/batch', { preHandler: [fastify.authenticate] }, handleMarkReadBatch);
}
