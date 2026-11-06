import { FastifyInstance } from 'fastify';
import { handleGetPublicProfile, handleListPublicProfiles, handleSitemap } from '../controllers/public-profile.controller.js';

/** Unauthenticated, read-only, rate limited: what a stranger or a search engine may fetch. */
export async function publicRoutes(fastify: FastifyInstance) {
  const limit = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };
  fastify.get('/profiles', limit, handleListPublicProfiles);
  fastify.get('/profiles/:handle', limit, handleGetPublicProfile);
  fastify.get('/sitemap.xml', limit, handleSitemap);
}
