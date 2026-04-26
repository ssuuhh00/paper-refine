import type { FastifyPluginAsync } from 'fastify';
import type { ApplyRequest, ApplyResponse, DecisionsPatch } from '@paper-refine/shared';
import { projectStore } from '../store/projects.js';
import { deleteRound, listRoundsInDir, loadFullRound, patchDecisions } from '../parse/round.js';
import { applyRound } from '../pipeline/apply.js';

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

  app.delete<{ Params: { id: string }; Querystring: { project_id?: string } }>(
    '/rounds/:id',
    async (req, reply) => {
      const projectId = req.query.project_id;
      if (!projectId) return reply.status(400).send({ error: 'project_id required' });
      const project = await projectStore.get(projectId);
      if (!project) return reply.status(404).send({ error: 'project not found' });
      const ok = await deleteRound(project, req.params.id);
      if (!ok) return reply.status(404).send({ error: 'round not found' });
      return { ok: true as const };
    },
  );

  app.post<{
    Params: { id: string };
    Querystring: { project_id?: string };
    Body: ApplyRequest;
  }>('/rounds/:id/apply', async (req, reply) => {
    const projectId = req.query.project_id;
    if (!projectId) return reply.status(400).send({ error: 'project_id required' });
    const project = await projectStore.get(projectId);
    if (!project) return reply.status(404).send({ error: 'project not found' });
    const dryRun = req.body?.dry_run === true;
    try {
      const outcome = await applyRound(project, req.params.id, { dryRun });
      const res: ApplyResponse = { ...outcome, dry_run: dryRun };
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'round not found') {
        return reply.status(404).send({ error: msg });
      }
      return reply.status(500).send({ error: msg });
    }
  });
};
