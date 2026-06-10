import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { authRoutes } from './routes/auth.routes.js';
import { articlesRoutes } from './routes/articles.routes.js';

const fastify = Fastify({ logger: true });

// 1. Register JWT Plugin with the secret key from .env
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is missing!');
}

fastify.register(fastifyJwt, {
  secret: process.env.JWT_SECRET
});

// Decorator to easily protect routes later
fastify.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// 2. Registering route plugins
fastify.register(authRoutes, { prefix: '/api/auth' });
fastify.register(articlesRoutes, { prefix: '/api/articles' });

fastify.get('/api/health', async () => {
  return { status: 'OK', message: 'TechTalk API is running smoothly' };
});

const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`Server readiness check passed on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
