import { FastifyInstance } from 'fastify';
import { handleGetIdentities, handleLinkGoogle, handleLinkGithubStart, handleUnlink, handleSetPassword } from '../controllers/identity.controller.js';
import { handleRegister, handleLogin, handleGoogleAuth, handleGithubStart, handleGithubCallback, handleUpdateProfile, handleGetMe, handleRefresh } from '../controllers/auth.controller.js';

export async function authRoutes(fastify: FastifyInstance) {
  const authRateLimit = { rateLimit: { max: 20, timeWindow: '1 minute' } };

  fastify.post('/register', { config: authRateLimit }, handleRegister);

  fastify.post('/login', { config: authRateLimit }, handleLogin);

  fastify.post('/google', { config: authRateLimit }, handleGoogleAuth);

  // GitHub OAuth: the browser navigates here, then GitHub returns to the callback.
  fastify.get('/github', handleGithubStart);
  fastify.get('/github/callback', handleGithubCallback);

  fastify.post('/refresh', { config: authRateLimit }, handleRefresh);

  fastify.patch('/profile', { preHandler: [fastify.authenticate] }, handleUpdateProfile);

  fastify.get('/me', { preHandler: [fastify.authenticate] }, handleGetMe);

  // Linked sign-in methods: e-mail + password, Google and GitHub on one account.
  fastify.get('/identities', { preHandler: [fastify.authenticate] }, handleGetIdentities);
  fastify.post('/link/google', { preHandler: [fastify.authenticate], config: authRateLimit }, handleLinkGoogle);
  fastify.post('/link/github', { preHandler: [fastify.authenticate], config: authRateLimit }, handleLinkGithubStart);
  fastify.delete('/link/:provider', { preHandler: [fastify.authenticate] }, handleUnlink);
  fastify.put('/password', { preHandler: [fastify.authenticate], config: authRateLimit }, handleSetPassword);
}
