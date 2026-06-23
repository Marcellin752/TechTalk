import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth.routes.js';
import { contentRoutes } from './routes/content.routes.js';
import { initAutomationWorkers } from './services/automation/index.js'; // 🟢 Mis à jour vers le dossier modulaire

const fastify = Fastify({ logger: false });

// Declare JWT type definitions for safety
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>;
    requireAdmin: (request: any, reply: any) => Promise<void>;
  }
}

// Global Plugins
fastify.register(cors, { origin: '*' });
fastify.register(jwt, {
  secret: process.env.JWT_SECRET || 'super-secret-key-change-me-in-production-2026'
});

// Authentication Security Decorators
fastify.decorate('authenticate', async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing token.' });
  }
});

fastify.decorate('requireAdmin', async (request: any, reply: any) => {
  // The role field is extracted out of the signed JWT payload
  if (!request.user || request.user.role !== 'admin') {
    reply.status(403).send({ 
      error: 'Forbidden', 
      message: 'Access denied. Only administrators can perform this action.' 
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
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
    
    await fastify.ready();
    await fastify.listen({ port, host: '0.0.0.0' });

    console.log('\n🚀 ===============================================');
    console.log('🔥 TechTalk Multimedia Backend is now LIVE!');
    console.log(`📡 Server running on: http://localhost:${port}`);
    console.log('===============================================\n');

    // Start the background automation multi-source worker
    initAutomationWorkers();

  } catch (err) {
    console.error('❌ Error during startup:', err);
    process.exit(1);
  }
};

start();