import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import { contentRoutes } from './routes/content.routes.js';
import { initAutomationWorkers } from './services/automation/index.js';

const fastify = Fastify({ logger: config.nodeEnv !== 'test' });

// Declare JWT type definitions for safety
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
    requireAdmin: (request: any, reply: any) => Promise<void>;
  }
}

// Global Plugins
fastify.register(cors, { origin: config.corsOrigin });
fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' });
fastify.register(jwt, { secret: config.jwtSecret });

// Authentication Security Decorators
// Note: sending the reply inside a preHandler stops the request chain in Fastify.
fastify.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing token.' });
  }
});

fastify.decorate('requireAdmin', async (request: any, reply: any) => {
  // The role field is extracted out of the signed JWT payload
  if (!request.user || request.user.role !== 'admin') {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Access denied. Only administrators can perform this action.',
    });
  }
});

// Register API Routes
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(contentRoutes, { prefix: '/api/content' });

// Health Check Route
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

    // Start the background automation multi-source worker
    initAutomationWorkers();

  } catch (err) {
    console.error(' Error during startup:', err);
    process.exit(1);
  }
};

start();
