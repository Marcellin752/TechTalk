import { FastifyInstance } from 'fastify';
import {
  handleStats, handleListUsers, handleSetRole, handleDeleteUser, handleRevokeSessions, handleListComments, handleDeleteComment,
  handleListContents, handleDeleteContent, handleSync, handleSyncStatus, requireDatabaseAdmin,
  handleListSchoolsAdmin, handleCreateSchool, handleUpdateSchool, handleRotateSchoolKey, handleDeleteSchool,
  handleListCampusResources, handleSetCampusResourceStatus, handleDeleteCampusResource, handleImportEvents, handleSetAmbassador,
} from '../controllers/admin.controller.js';

export async function adminRoutes(fastify: FastifyInstance) {
  const admin = { preHandler: [fastify.authenticate, fastify.requireAdmin, requireDatabaseAdmin] };
  fastify.get('/stats', admin, handleStats);
  fastify.get('/users', admin, handleListUsers);
  fastify.patch('/users/:id/role', admin, handleSetRole);
  fastify.post('/users/:id/sign-out', admin, handleRevokeSessions);
  fastify.delete('/users/:id', admin, handleDeleteUser);
  fastify.get('/comments', admin, handleListComments);
  fastify.delete('/comments/:id', admin, handleDeleteComment);
  fastify.get('/contents', admin, handleListContents);
  fastify.delete('/contents/:id', admin, handleDeleteContent);
  fastify.post('/sync', { ...admin, config: { rateLimit: { max: 3, timeWindow: '1 minute' } } }, handleSync);
  fastify.get('/sync', admin, handleSyncStatus);
  fastify.get('/schools', admin, handleListSchoolsAdmin);
  fastify.post('/schools', admin, handleCreateSchool);
  fastify.patch('/schools/:id', admin, handleUpdateSchool);
  fastify.post('/schools/:id/key', { ...admin, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, handleRotateSchoolKey);
  fastify.delete('/schools/:id', admin, handleDeleteSchool);
  fastify.post('/schools/:id/events/import', { ...admin, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, handleImportEvents);
  fastify.patch('/users/:id/ambassador', admin, handleSetAmbassador);
  fastify.get('/campus/resources', admin, handleListCampusResources);
  fastify.patch('/campus/resources/:id', admin, handleSetCampusResourceStatus);
  fastify.delete('/campus/resources/:id', admin, handleDeleteCampusResource);
}
