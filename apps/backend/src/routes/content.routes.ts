import { FastifyInstance } from 'fastify';
import { handleGetContents, handleCreateContent } from '../controllers/content.controller.js';

export async function contentRoutes(fastify: FastifyInstance) {
  // Publicly readable for authenticated users
  fastify.get('/', { preHandler: [fastify.authenticate] }, handleGetContents);

  // Protected: Only authenticated administrators can manually append content
  fastify.post('/', { preHandler: [fastify.authenticate, fastify.requireAdmin] }, handleCreateContent);
}
