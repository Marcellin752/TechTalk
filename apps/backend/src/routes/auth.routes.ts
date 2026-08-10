import { FastifyInstance } from 'fastify';
import { handleRegister, handleLogin, handleGoogleAuth, handleUpdateProfile, handleGetMe, handleRefresh } from '../controllers/auth.controller.js';

export async function authRoutes(fastify: FastifyInstance) {
  const authRateLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } };

  // POST /api/auth/register
  fastify.post('/register', { config: authRateLimit }, handleRegister);

  // POST /api/auth/login
  fastify.post('/login', { config: authRateLimit }, handleLogin);

  // POST /api/auth/google
  fastify.post('/google', { config: authRateLimit }, handleGoogleAuth);

  // POST /api/auth/refresh
  fastify.post('/refresh', { config: authRateLimit }, handleRefresh);

  // PATCH /api/auth/profile
  fastify.patch('/profile', { preHandler: [fastify.authenticate] }, handleUpdateProfile);

  // GET /api/auth/me
  fastify.get('/me', { preHandler: [fastify.authenticate] }, handleGetMe);
}
