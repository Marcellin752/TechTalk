import { FastifyInstance } from 'fastify';
import { handleGetLearningProfile, handleSaveLearningProfile, handleGetPath, handleRegeneratePath, handleUpdateStep, handleListSchools, handleSetSchool, handleSetConsent,
  handleListPaths, handleGetPathById, handleCreatePath, handleRebuildPath, handleUpdatePath, handleDeletePath } from '../controllers/learning.controller.js';

export async function learningRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  fastify.get('/profile', auth, handleGetLearningProfile);
  fastify.put('/profile', { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, handleSaveLearningProfile);
  fastify.get('/path', auth, handleGetPath);
  fastify.post('/path/regenerate', { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, handleRegeneratePath);
  fastify.get('/schools', auth, handleListSchools);
  fastify.put('/school', { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, handleSetSchool);
  fastify.put('/consent', auth, handleSetConsent);
  fastify.get('/paths', auth, handleListPaths);
  fastify.post('/paths', { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, handleCreatePath);
  fastify.get('/paths/:id', auth, handleGetPathById);
  fastify.post('/paths/:id/regenerate', { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, handleRebuildPath);
  fastify.patch('/paths/:id', auth, handleUpdatePath);
  fastify.delete('/paths/:id', auth, handleDeletePath);
  fastify.patch('/steps/:stepId', auth, handleUpdateStep);
}
