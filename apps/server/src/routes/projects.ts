import type { FastifyPluginAsync } from 'fastify';
import { promises as fs } from 'node:fs';
import fg from 'fast-glob';
import type {
  ProjectInput,
  ProjectValidateRequest,
  ProjectValidateResponse,
} from '@paper-refine/shared';
import { projectStore } from '../store/projects.js';
import { resolveAbsolute } from '../util/paths.js';

const DEFAULT_GLOB = 'sections/*.tex';

function withDefaults(input: ProjectInput): ProjectInput {
  return {
    name: input.name.trim(),
    latex_root: resolveAbsolute(input.latex_root),
    sections_glob: input.sections_glob || DEFAULT_GLOB,
    ...(input.output_dir ? { output_dir: resolveAbsolute(input.output_dir) } : {}),
    ...(input.error_notes_path
      ? { error_notes_path: resolveAbsolute(input.error_notes_path) }
      : {}),
  };
}

async function validate(req: ProjectValidateRequest): Promise<ProjectValidateResponse> {
  const latex_root = resolveAbsolute(req.latex_root);
  const sections_glob = req.sections_glob || DEFAULT_GLOB;

  let exists = false;
  let is_directory = false;
  try {
    const stat = await fs.stat(latex_root);
    exists = true;
    is_directory = stat.isDirectory();
  } catch {
    return {
      latex_root,
      exists: false,
      is_directory: false,
      sections_found: 0,
      sample_sections: [],
    };
  }

  if (!is_directory) {
    return { latex_root, exists, is_directory, sections_found: 0, sample_sections: [] };
  }

  const matches = await fg(sections_glob, {
    cwd: latex_root,
    dot: false,
    onlyFiles: true,
    suppressErrors: true,
  });
  matches.sort();
  return {
    latex_root,
    exists,
    is_directory,
    sections_found: matches.length,
    sample_sections: matches.slice(0, 5),
  };
}

export const projectsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/projects', async () => projectStore.list());

  app.post<{ Body: ProjectValidateRequest }>('/projects/validate', async (req, reply) => {
    if (!req.body?.latex_root) {
      return reply.status(400).send({ error: 'latex_root required' });
    }
    return validate(req.body);
  });

  app.post<{ Body: ProjectInput }>('/projects', async (req, reply) => {
    const body = req.body;
    if (!body?.name?.trim() || !body?.latex_root?.trim()) {
      return reply.status(400).send({ error: 'name and latex_root required' });
    }
    return projectStore.create(withDefaults(body));
  });

  app.patch<{ Params: { id: string }; Body: Partial<ProjectInput> }>(
    '/projects/:id',
    async (req, reply) => {
      const existing = await projectStore.get(req.params.id);
      if (!existing) return reply.status(404).send({ error: 'not found' });
      const merged = withDefaults({
        name: req.body?.name ?? existing.name,
        latex_root: req.body?.latex_root ?? existing.latex_root,
        sections_glob: req.body?.sections_glob ?? existing.sections_glob,
        output_dir: req.body?.output_dir ?? existing.output_dir,
        error_notes_path: req.body?.error_notes_path ?? existing.error_notes_path,
      });
      const updated = await projectStore.update(req.params.id, merged);
      if (!updated) return reply.status(404).send({ error: 'not found' });
      return updated;
    },
  );

  app.delete<{ Params: { id: string } }>('/projects/:id', async (req, reply) => {
    const ok = await projectStore.remove(req.params.id);
    if (!ok) return reply.status(404).send({ error: 'not found' });
    return { ok: true as const };
  });

  app.get<{ Params: { id: string } }>('/projects/:id/sections', async (req, reply) => {
    const project = await projectStore.get(req.params.id);
    if (!project) return reply.status(404).send({ error: 'not found' });
    const matches = await fg(project.sections_glob, {
      cwd: project.latex_root,
      dot: false,
      onlyFiles: true,
      suppressErrors: true,
    });
    matches.sort();
    return {
      latex_root: project.latex_root,
      sections_glob: project.sections_glob,
      sections: matches.map((rel) => ({
        rel,
        name: rel.split('/').pop() ?? rel,
      })),
      total: matches.length,
    };
  });
};
