import { FastifyInstance } from 'fastify';
import { handleKairosStatus, handleKairosChat, handleListConversations, handleGetConversation, handleDeleteConversation, handleClearConversations, handleMessageFeedback, handleRenameConversation, handleListMemory, handleDeleteMemory } from '../controllers/kairos.controller.js';

export async function kairosRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  fastify.get('/status', auth, handleKairosStatus);
  fastify.post('/chat', { ...auth, config: { rateLimit: { max: 15, timeWindow: '1 minute' } } }, handleKairosChat);
  fastify.patch('/messages/:id/feedback', auth, handleMessageFeedback);
  fastify.get('/memory', auth, handleListMemory);
  fastify.delete('/memory', auth, handleDeleteMemory);
  fastify.delete('/memory/:id', auth, handleDeleteMemory);
  fastify.get('/conversations', auth, handleListConversations);
  fastify.delete('/conversations', auth, handleClearConversations);
  fastify.get('/conversations/:id', auth, handleGetConversation);
  fastify.patch('/conversations/:id', auth, handleRenameConversation);
  fastify.delete('/conversations/:id', auth, handleDeleteConversation);
}
