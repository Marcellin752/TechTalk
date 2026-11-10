import { FastifyInstance } from 'fastify';
import { handleCards, handleCreateCard, handleUpdateCard, handleDeleteCard, handleGradeCard } from '../controllers/memory.controller.js';
import { handleProjects, handleCreateProject, handleUpdateProject, handleDeleteProject, handleProjectPlan, handleResearch, handleAddResearch, handleDeleteResearch, handleSynthesize } from '../controllers/lab.controller.js';
import { handleRooms, handleCreateRoom, handleJoinRoom, handleLeaveRoom, handleRoomMessages, handlePostMessage, handleReportMessage, handleMentorProfile, handleSaveMentorProfile, handleLeaveMentoring, handleMentorMatch, handleMentorRequest, handleMentorRequests, handleMentorRespond } from '../controllers/community.controller.js';
import { handleAnalytics, handleBriefing, handleCoach, handleDiscover, handleTrends, handleExercises, handleExercisePassed, handleSetPortfolio, handleMyPortfolio } from '../controllers/insights.controller.js';

/** Memory, projects, research, community and insights: everything that grows from the skills base. */
export async function growthRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: [fastify.authenticate] };
  const limit = (max: number, timeWindow = '1 minute') => ({ ...auth, config: { rateLimit: { max, timeWindow } } });

  fastify.get('/cards', auth, handleCards);
  fastify.post('/cards', limit(60), handleCreateCard);
  fastify.patch('/cards/:id', auth, handleUpdateCard);
  fastify.delete('/cards/:id', auth, handleDeleteCard);
  fastify.post('/cards/:id/grade', limit(120), handleGradeCard);

  fastify.get('/projects', auth, handleProjects);
  fastify.post('/projects', limit(20), handleCreateProject);
  fastify.post('/projects/plan', limit(6), handleProjectPlan);
  fastify.patch('/projects/:id', auth, handleUpdateProject);
  fastify.delete('/projects/:id', auth, handleDeleteProject);

  fastify.get('/research', auth, handleResearch);
  fastify.post('/research', limit(60), handleAddResearch);
  fastify.post('/research/synthesize', limit(6), handleSynthesize);
  fastify.delete('/research/:id', auth, handleDeleteResearch);

  fastify.get('/rooms', auth, handleRooms);
  fastify.post('/rooms', limit(5), handleCreateRoom);
  fastify.post('/rooms/:id/join', limit(30), handleJoinRoom);
  fastify.delete('/rooms/:id/membership', auth, handleLeaveRoom);
  fastify.get('/rooms/:id/messages', limit(90), handleRoomMessages);
  fastify.post('/rooms/:id/messages', limit(12), handlePostMessage);
  fastify.post('/messages/:id/report', limit(20), handleReportMessage);

  fastify.get('/mentor/profile', auth, handleMentorProfile);
  fastify.put('/mentor/profile', limit(20), handleSaveMentorProfile);
  fastify.delete('/mentor/profile', auth, handleLeaveMentoring);
  fastify.get('/mentor/match', limit(30), handleMentorMatch);
  fastify.post('/mentor/requests', limit(10, '1 hour'), handleMentorRequest);
  fastify.get('/mentor/requests', auth, handleMentorRequests);
  fastify.post('/mentor/requests/:id/respond', limit(30), handleMentorRespond);

  fastify.get('/analytics', auth, handleAnalytics);
  fastify.get('/briefing', auth, handleBriefing);
  fastify.post('/coach', limit(6), handleCoach);
  fastify.get('/discover', limit(30), handleDiscover);
  fastify.get('/trends', auth, handleTrends);
  fastify.get('/exercises', auth, handleExercises);
  fastify.post('/exercises/:id/passed', limit(30), handleExercisePassed);
  fastify.get('/portfolio', auth, handleMyPortfolio);
  fastify.put('/portfolio', auth, handleSetPortfolio);
}
