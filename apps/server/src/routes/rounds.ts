import type { FastifyPluginAsync } from 'fastify';
import type { DecisionsPatch } from '@paper-refine/shared';
import { projectStore } from '../store/projects.js';
import { listRoundsInDir, loadFullRound, patchDecisions } from '../parse/round.js';

export const roundsRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { project_id?: string } }>('/rounds', async (req, reply) => {
    const projectId = req.query.project_id;
    if (!projectId) return reply.status(400).send({ error: 'project_id required' });
    const project = await projectStore.get(projectId);
    if (!project) return reply.status(404).send({ error: 'project not found' });
    return listRoundsInDir(project.output_dir, project.id);
  });

  app.get<{ Params: { id: string }; Querystring: { project_id?: string } }>(
    '/rounds/:id',
    async (req, reply) => {
      const projectId = req.query.project_id;
      if (!projectId) return reply.status(400).send({ error: 'project_id required' });
      const project = await projectStore.get(projectId);
      if (!project) return reply.status(404).send({ error: 'project not found' });
      const round = await loadFullRound(project, req.params.id);
      if (!round) return reply.status(404).send({ error: 'round not found' });
      return round;
    },
  );

  app.patch<{
    Params: { id: string };
    Querystring: { project_id?: string };
    Body: DecisionsPatch;
  }>('/rounds/:id/decisions', async (req, reply) => {
    const projectId = req.query.project_id;
    if (!projectId) return reply.status(400).send({ error: 'project_id required' });
    const project = await projectStore.get(projectId);
    if (!project) return reply.status(404).send({ error: 'project not found' });
    if (!req.body || typeof req.body !== 'object') {
      return reply.status(400).send({ error: 'body must be an object of decisions' });
    }
    const merged = await patchDecisions(project, req.params.id, req.body);
    return { decisions: merged };
  });

  app.post<{
    Params: { id: string };
    Querystring: { project_id?: string };
  }>('/rounds/:id/apply', async (_req, reply) => {
    // Placeholder — actual .tex apply + error_notes append lands in a follow-up.
    return reply.status(501).send({ error: 'apply pipeline not implemented yet' });
  });
};
