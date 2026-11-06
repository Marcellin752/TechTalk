import { FastifyInstance } from 'fastify';
import { handleGetLearningProfile, handleSaveLearningProfile, handleGetPath, handleRegeneratePath, handleUpdateStep } from '../controllers/learning.controller.js';

export async function learningRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  fastify.get('/profile', auth, handleGetLearningProfile);
  fastify.put('/profile', { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, handleSaveLearningProfile);
  fastify.get('/path', auth, handleGetPath);
  fastify.post('/path/regenerate', { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, handleRegeneratePath);
  fastify.patch('/steps/:stepId', auth, handleUpdateStep);
}
