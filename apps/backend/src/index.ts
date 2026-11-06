import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { sql } from 'drizzle-orm';
import { db } from './db/db.js';
import { config } from './config/env.js';
import { authRoutes } from './routes/auth.routes.js';
import { contentRoutes } from './routes/content.routes.js';
import { profileRoutes } from './routes/profile.routes.js';
import { learningRoutes } from './routes/learning.routes.js';
import { kairosRoutes } from './routes/kairos.routes.js';
import { publicRoutes } from './routes/public.routes.js';
import { initAutomationWorkers } from './services/automation/index.js';

// Behind a hosting proxy (Render, Vercel…) the socket address is the proxy's, so
// without this every visitor shares one rate-limit bucket and `request.ip` is wrong.
const fastify = Fastify({
  logger:
    config.nodeEnv === 'test'
      ? false
      : { redact: ['req.headers.authorization', 'req.headers.cookie'] },
  trustProxy: config.nodeEnv === 'production',
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
    requireAdmin: (request: any, reply: any) => Promise<void>;
  }
}

// @fastify/cors only allows GET, HEAD and POST by default; the API also uses PUT, PATCH and DELETE.
fastify.register(cors, { origin: config.corsOrigin, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] });
// This is a JSON API, so the default policy is the strict one; the site sets its own CSP.
fastify.register(helmet, { crossOriginResourcePolicy: { policy: 'cross-origin' } });
fastify.register(rateLimit, { max: 100, timeWindow: '1 minute' });
fastify.register(jwt, { secret: config.jwtSecret });

fastify.addHook('onSend', async (_request, reply, payload) => {
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
fastify.register(profileRoutes, { prefix: '/api/profile' });
fastify.register(learningRoutes, { prefix: '/api/learning' });
fastify.register(kairosRoutes, { prefix: '/api/kairos' });
fastify.register(publicRoutes, { prefix: '/api/public' });

// One shape for every failure, and no stack traces or SQL leaking to the client.
fastify.setErrorHandler((error: any, request, reply) => {
  const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
  if (status >= 500) request.log.error(error);
  reply.status(status).send({
    error: status >= 500 ? 'Internal Server Error' : error.name || 'Error',
    message: status >= 500 ? 'Something went wrong on our side.' : error.message,
  });
});

fastify.setNotFoundHandler((_request, reply) => {
  reply.status(404).send({ error: 'Not Found', message: 'No such endpoint.' });
});

// Liveness for the platform; /api/ready also proves the database answers.
fastify.get('/api/health', async () => ({ status: 'OK', message: 'TechTalk API is running smoothly' }));
fastify.get('/api/ready', async (_request, reply) => {
  try {
    await db.execute(sql`select 1`);
    return { status: 'ready' };
  } catch {
    return reply.status(503).send({ status: 'unavailable' });
  }
});

const start = async () => {
  try {
    const fastify = await createApp();
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

// Let in-flight requests finish when the platform stops the container.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    fastify.log.info(`${signal} received, shutting down`);
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    fastify.close().then(() => process.exit(0), () => process.exit(1));
  });
}

start();
