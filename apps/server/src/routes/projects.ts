import type { FastifyPluginAsync } from 'fastify';
import type { ProjectInput } from '@paper-refine/shared';
import { projectStore } from '../store/projects.js';

export const projectsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/projects', async () => projectStore.list());

  app.post<{ Body: ProjectInput }>('/projects', async (req, reply) => {
    const body = req.body;
    if (!body?.name || !body?.latex_root) {
      return reply.status(400).send({ error: 'name and latex_root required' });
    }
    return projectStore.create({
      name: body.name,
      latex_root: body.latex_root,
      sections_glob: body.sections_glob || 'sections/*.tex',
      output_dir: body.output_dir || `${body.latex_root}/refine_output`,
      error_notes_path:
        body.error_notes_path ||
        `${body.output_dir || `${body.latex_root}/refine_output`}/error_notes.md`,
    });
  });

  app.patch<{ Params: { id: string }; Body: Partial<ProjectInput> }>(
    '/projects/:id',
    async (req, reply) => {
      const updated = await projectStore.update(req.params.id, req.body ?? {});
      if (!updated) return reply.status(404).send({ error: 'not found' });
      return updated;
    },
  );

  app.delete<{ Params: { id: string } }>('/projects/:id', async (req, reply) => {
    const ok = await projectStore.remove(req.params.id);
    if (!ok) return reply.status(404).send({ error: 'not found' });
    return { ok: true as const };
  });
};
