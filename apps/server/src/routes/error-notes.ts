import type { FastifyPluginAsync } from 'fastify';
import { projectStore } from '../store/projects.js';
import { aggregateErrorNotes } from '../parse/error-notes.js';

export const errorNotesRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { project_id?: string } }>('/error-notes', async (req, reply) => {
    const projectId = req.query.project_id;
    if (!projectId) return reply.status(400).send({ error: 'project_id required' });
    const project = await projectStore.get(projectId);
    if (!project) return reply.status(404).send({ error: 'project not found' });
    return aggregateErrorNotes(project);
  });
};
