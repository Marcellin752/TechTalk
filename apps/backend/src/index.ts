import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import { contentRoutes } from './routes/content.routes.js';
import { initAutomationWorkers } from './services/automation/index.js';

const fastify = Fastify({ logger: config.nodeEnv !== 'test' });

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
    requireAdmin: (request: any, reply: any) => Promise<void>;
  }
}

fastify.register(cors, { origin: config.corsOrigin });
fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' });
fastify.register(jwt, { secret: config.jwtSecret });

fastify.addHook('onSend', async (_request, reply, payload) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('X-Frame-Options', 'DENY');
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return payload;
});

fastify.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing token.' });
  }
});

fastify.decorate('requireAdmin', async (request: any, reply: any) => {
  if (!request.user || request.user.role !== 'admin') {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Access denied. Only administrators can perform this action.',
    });
  }
});

fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(contentRoutes, { prefix: '/api/content' });

fastify.get('/api/health', async () => {
  return { status: 'OK', message: 'TechTalk API is running smoothly' };
});

const start = async () => {
  try {
    await fastify.ready();
    await fastify.listen({ port: config.port, host: '0.0.0.0' });

    console.log('\n===============================================');
    console.log(' TechTalk Multimedia Backend is now LIVE!');
    console.log(`Server running on: http://localhost:${config.port}`);
    console.log('===============================================\n');

    initAutomationWorkers();

  } catch (err) {
    console.error(' Error during startup:', err);
    process.exit(1);
  }
};

start();
