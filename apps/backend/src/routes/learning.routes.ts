import { FastifyInstance } from 'fastify';
import { handleGetLearningProfile, handleSaveLearningProfile, handleGetPath, handleRegeneratePath, handleUpdateStep, handleListSchools, handleSetSchool, handleSetConsent,
  handleListPaths, handleGetPathById, handleCreatePath, handleRebuildPath, handleUpdatePath, handleDeletePath } from '../controllers/learning.controller.js';
import { handleGetQuiz, handleRenewQuiz, handleSubmitQuiz, handleDueReviews, handleAnswerReview, handleLinkCodewars, handleUnlinkCodewars, handleSyncCodewars } from '../controllers/progress.controller.js';
import { handleWeek, handleUpcoming, handleOpportunities } from '../controllers/habits.controller.js';

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
  const slow = { ...auth, config: { rateLimit: { max: 6, timeWindow: '1 minute' } } };
  fastify.post('/paths/:id/stages/:index/quiz', slow, handleGetQuiz);
  fastify.post('/quizzes/:id/renew', slow, handleRenewQuiz);
  fastify.post('/quizzes/:id/submit', auth, handleSubmitQuiz);
  fastify.get('/reviews', auth, handleDueReviews);
  fastify.post('/reviews/:id/answer', auth, handleAnswerReview);
  fastify.put('/codewars', auth, handleLinkCodewars);
  fastify.delete('/codewars', auth, handleUnlinkCodewars);
  fastify.post('/codewars/sync', auth, handleSyncCodewars);
  fastify.get('/week', auth, handleWeek);
  fastify.get('/upcoming', auth, handleUpcoming);
  fastify.get('/opportunities', auth, handleOpportunities);
  fastify.patch('/steps/:stepId', auth, handleUpdateStep);
}
