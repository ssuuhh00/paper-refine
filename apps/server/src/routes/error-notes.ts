import type { FastifyPluginAsync } from 'fastify';
import { projectStore } from '../store/projects.js';
import { aggregateErrorNotes, rebuildErrorNotesMd } from '../parse/error-notes.js';
import { addDismissed, type DismissedKey } from '../store/dismissed-notes.js';

function isKeyArray(x: unknown): x is DismissedKey[] {
  if (!Array.isArray(x)) return false;
  return x.every(
    (v) =>
      v &&
      typeof v === 'object' &&
      typeof (v as DismissedKey).round === 'string' &&
      typeof (v as DismissedKey).key === 'string' &&
      ((v as DismissedKey).source === 'user' ||
        (v as DismissedKey).source === 'discriminator'),
  );
}

export const errorNotesRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { project_id?: string } }>('/error-notes', async (req, reply) => {
    const projectId = req.query.project_id;
    if (!projectId) return reply.status(400).send({ error: 'project_id required' });
    const project = await projectStore.get(projectId);
    if (!project) return reply.status(404).send({ error: 'project not found' });
    return aggregateErrorNotes(project);
  });

  /**
   * Hide one or more error-note rows from the timeline + drop them from the
   * Generator's input file. Body is an array of {round, key, source}.
   */
  app.post<{
    Querystring: { project_id?: string };
    Body: DismissedKey[];
  }>('/error-notes/dismiss', async (req, reply) => {
    const projectId = req.query.project_id;
    if (!projectId) return reply.status(400).send({ error: 'project_id required' });
    const project = await projectStore.get(projectId);
    if (!project) return reply.status(404).send({ error: 'project not found' });
    if (!isKeyArray(req.body) || req.body.length === 0) {
      return reply.status(400).send({ error: 'body must be a non-empty array of {round, key, source}' });
    }
    await addDismissed(project, req.body);
    await rebuildErrorNotesMd(project);
    return aggregateErrorNotes(project);
  });

  /** Dismiss every currently visible error note. Equivalent to "clear all". */
  app.post<{ Querystring: { project_id?: string } }>(
    '/error-notes/dismiss-all',
    async (req, reply) => {
      const projectId = req.query.project_id;
      if (!projectId) return reply.status(400).send({ error: 'project_id required' });
      const project = await projectStore.get(projectId);
      if (!project) return reply.status(404).send({ error: 'project not found' });
      const current = await aggregateErrorNotes(project);
      if (current.length === 0) return [];
      await addDismissed(
        project,
        current.map((n) => ({ round: n.round, key: n.key, source: n.source })),
      );
      await rebuildErrorNotesMd(project);
      return [];
    },
  );
};
