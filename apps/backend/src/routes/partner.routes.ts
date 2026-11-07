import { FastifyInstance } from 'fastify';
import {
  requireSchoolKey, handlePartnerMe, handlePutCurriculum, handlePutEvents, handleListPartnerEvents, handleDeletePartnerEvent, handleStats, handlePutResources,
} from '../controllers/partner.controller.js';

/** The API a school uses with its key: curriculum, calendar events, anonymous statistics. */
export async function partnerRoutes(fastify: FastifyInstance) {
  const school = { preHandler: [requireSchoolKey], config: { rateLimit: { max: 120, timeWindow: '1 minute' } } };
  fastify.get('/me', school, handlePartnerMe);
  fastify.put('/curriculum', school, handlePutCurriculum);
  fastify.get('/events', school, handleListPartnerEvents);
  fastify.put('/events', school, handlePutEvents);
  fastify.delete('/events/:externalId', school, handleDeletePartnerEvent);
  fastify.put('/resources', school, handlePutResources);
  fastify.get('/stats', school, handleStats);
}
