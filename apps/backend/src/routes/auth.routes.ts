import { FastifyInstance } from 'fastify';
import { handleRegister, handleLogin } from '../controllers/auth.controller.js';

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/register
  fastify.post('/register', handleRegister);

  // POST /api/auth/login
  fastify.post('/login', handleLogin);
}
