import { FastifyInstance } from 'fastify';
import {
  handleCampusOverview, handleListResources, handleCreateResource, handleVoteResource, handleReportResource, handleDeleteResource,
  handleListSessions, handleCreateSession, handleJoinSession, handleLeaveSession, handleCancelSession, handleUpdateCampusProfile, handleListPeople, handleProgramme,
} from '../controllers/campus.controller.js';

/** The campus of a learner's school: revisions, past exams, people. */
export async function campusRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  const write = { ...auth, config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };
  fastify.get('/', auth, handleCampusOverview);

  fastify.get('/programme', auth, handleProgramme);

  fastify.get('/resources', auth, handleListResources);
  fastify.post('/resources', write, handleCreateResource);
  fastify.post('/resources/:id/vote', write, handleVoteResource);
  fastify.post('/resources/:id/report', write, handleReportResource);
  fastify.delete('/resources/:id', write, handleDeleteResource);

  fastify.get('/sessions', auth, handleListSessions);
  fastify.post('/sessions', write, handleCreateSession);
  fastify.post('/sessions/:id/join', write, handleJoinSession);
  fastify.delete('/sessions/:id/join', write, handleLeaveSession);
  fastify.delete('/sessions/:id', write, handleCancelSession);

  fastify.put('/me', write, handleUpdateCampusProfile);
  fastify.get('/people', auth, handleListPeople);
}
