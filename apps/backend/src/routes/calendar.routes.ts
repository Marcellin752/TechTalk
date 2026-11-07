import { FastifyInstance } from 'fastify';
import { handleListEvents, handleCreateEvent, handleUpdateEvent, handleDeleteEvent, handlePlan, handleExportIcs } from '../controllers/calendar.controller.js';

export async function calendarRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  fastify.get('/', auth, handleListEvents);
  fastify.post('/', auth, handleCreateEvent);
  fastify.patch('/:id', auth, handleUpdateEvent);
  fastify.delete('/:id', auth, handleDeleteEvent);
  fastify.post('/plan', { ...auth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, handlePlan);
  fastify.get('/export.ics', auth, handleExportIcs);
}
