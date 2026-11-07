import { FastifyInstance } from 'fastify';
import { handleSkills, handleSkill, handleExplain, handleContest, handleHideEdge, handleForget } from '../controllers/skills.controller.js';

/** What the learner knows, with the evidence for it. */
export async function skillsRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  const slow = { ...auth, config: { rateLimit: { max: 8, timeWindow: '1 minute' } } };
  fastify.get('/', auth, handleSkills);
  fastify.delete('/', auth, handleForget);
  fastify.post('/edges/:id/hide', auth, handleHideEdge);
  fastify.post('/evaluations/:id/contest', slow, handleContest);
  fastify.get('/:slug', auth, handleSkill);
  fastify.post('/:slug/explain', slow, handleExplain);
  fastify.delete('/:slug', auth, handleForget);
}
