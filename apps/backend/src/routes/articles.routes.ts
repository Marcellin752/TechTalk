import { FastifyInstance } from 'fastify';

export async function articlesRoutes(fastify: FastifyInstance) {
  // GET /api/articles
  fastify.get('/', async (request, reply) => {
    return reply.status(200).send({ message: 'Articles route placeholder' });
  });
}
