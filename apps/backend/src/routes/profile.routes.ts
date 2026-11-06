import { FastifyInstance } from 'fastify';
import { handleGetGithubProfile, handleSyncGithubProfile } from '../controllers/profile.controller.js';

export async function profileRoutes(fastify: FastifyInstance) {
  fastify.get('/github', { preHandler: [fastify.authenticate] }, handleGetGithubProfile);
  fastify.post('/github/sync', { preHandler: [fastify.authenticate], config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, handleSyncGithubProfile);
}
