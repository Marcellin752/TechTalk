import { FastifyInstance } from 'fastify';
import { handleGetSettings, handleSaveSettings, handleCheckHandle } from '../controllers/public-profile.controller.js';
import { handleGetGithubProfile, handleSyncGithubProfile, handleGetHistory, handleClearHistory } from '../controllers/profile.controller.js';

export async function profileRoutes(fastify: FastifyInstance) {
  fastify.get('/github', { preHandler: [fastify.authenticate] }, handleGetGithubProfile);
  fastify.post('/github/sync', { preHandler: [fastify.authenticate], config: { rateLimit: { max: 10, timeWindow: '1 hour' } } }, handleSyncGithubProfile);
  fastify.get('/history', { preHandler: [fastify.authenticate] }, handleGetHistory);
  fastify.delete('/history', { preHandler: [fastify.authenticate] }, handleClearHistory);
  fastify.get('/settings', { preHandler: [fastify.authenticate] }, handleGetSettings);
  fastify.put('/settings', { preHandler: [fastify.authenticate], config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, handleSaveSettings);
  fastify.get('/settings/handle', { preHandler: [fastify.authenticate], config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, handleCheckHandle);
}
