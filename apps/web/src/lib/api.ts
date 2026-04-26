import type {
  ApplyRequest,
  ApplyResponse,
  Decision,
  DecisionsPatch,
  ErrorNote,
  PipelineEvent,
  Project,
  ProjectInput,
  ProjectValidateRequest,
  ProjectValidateResponse,
  Round,
  RoundSummary,
  Run,
  RunRequest,
} from '@paper-refine/shared';

const base = '/api';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ''}`);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => http<{ ok: true }>('/health'),

  listProjects: () => http<Project[]>('/projects'),
  createProject: (input: ProjectInput) =>
    http<Project>('/projects', { method: 'POST', body: JSON.stringify(input) }),
  updateProject: (id: string, patch: Partial<ProjectInput>) =>
    http<Project>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteProject: (id: string) => http<{ ok: true }>(`/projects/${id}`, { method: 'DELETE' }),
  validateProject: (input: ProjectValidateRequest) =>
    http<ProjectValidateResponse>('/projects/validate', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listRounds: (projectId: string) =>
    http<RoundSummary[]>(`/rounds?project_id=${encodeURIComponent(projectId)}`),
  getRound: (projectId: string, id: string) =>
    http<Round>(`/rounds/${id}?project_id=${encodeURIComponent(projectId)}`),
  patchDecisions: (projectId: string, id: string, patch: DecisionsPatch) =>
    http<{ decisions: Record<string, Decision> }>(
      `/rounds/${id}/decisions?project_id=${encodeURIComponent(projectId)}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),

  applyRound: (projectId: string, roundId: string, body: ApplyRequest) =>
    http<ApplyResponse>(
      `/rounds/${roundId}/apply?project_id=${encodeURIComponent(projectId)}`,
      { method: 'POST', body: JSON.stringify(body) },
    ),

  listSections: (projectId: string) =>
    http<{
      latex_root: string;
      sections_glob: string;
      sections: { rel: string; name: string }[];
      total: number;
    }>(`/projects/${projectId}/sections`),

  startRun: (req: RunRequest) =>
    http<{ run_id: string }>('/rounds/run', { method: 'POST', body: JSON.stringify(req) }),

  getRun: (runId: string) =>
    http<{ run: Run; events: PipelineEvent[] }>(`/runs/${runId}`),

  listRuns: () => http<{ active: string | null; runs: Run[] }>('/runs'),

  listErrorNotes: (projectId: string) =>
    http<ErrorNote[]>(`/error-notes?project_id=${encodeURIComponent(projectId)}`),
};
