import { FastifyInstance } from 'fastify';
import { handleRegister, handleLogin, handleGoogleAuth, handleUpdateProfile, handleGetMe, handleRefresh } from '../controllers/auth.controller.js';

export async function authRoutes(fastify: FastifyInstance) {
  const authRateLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } };

  fastify.post('/register', { config: authRateLimit }, handleRegister);

  fastify.post('/login', { config: authRateLimit }, handleLogin);

  fastify.post('/google', { config: authRateLimit }, handleGoogleAuth);

  fastify.post('/refresh', { config: authRateLimit }, handleRefresh);

  fastify.patch('/profile', { preHandler: [fastify.authenticate] }, handleUpdateProfile);

  fastify.get('/me', { preHandler: [fastify.authenticate] }, handleGetMe);
}
