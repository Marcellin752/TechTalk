import { FastifyInstance } from 'fastify';
import { handleKairosStatus, handleKairosChat, handleListConversations, handleGetConversation, handleDeleteConversation, handleClearConversations } from '../controllers/kairos.controller.js';

export async function kairosRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  fastify.get('/status', auth, handleKairosStatus);
  fastify.post('/chat', { ...auth, config: { rateLimit: { max: 15, timeWindow: '1 minute' } } }, handleKairosChat);
  fastify.get('/conversations', auth, handleListConversations);
  fastify.delete('/conversations', auth, handleClearConversations);
  fastify.get('/conversations/:id', auth, handleGetConversation);
  fastify.delete('/conversations/:id', auth, handleDeleteConversation);
}
