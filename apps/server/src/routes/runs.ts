import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import type { PipelineEvent, RunRequest } from '@paper-refine/shared';
import { projectStore } from '../store/projects.js';
import { runPipeline, type RunPlan } from '../pipeline/index.js';
import {
  activeRunId,
  createRun,
  finishRun,
  getEntry,
  listRuns,
  pushEvent,
  setActive,
  setStatus,
} from '../runs/store.js';
import type { Entry } from '../runs/store.js';
import { checkClaudeAvailable } from '../pipeline/claude.js';

const ALLOWED_PERSONAS = new Set(['ieee', 'outsider', 'writing', 'structure']);
const ALLOWED_MODELS = new Set(['haiku', 'sonnet', 'opus']);

export const runsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/runs', async () => ({ active: activeRunId(), runs: listRuns() }));

  app.get<{ Params: { id: string } }>('/runs/:id', async (req, reply) => {
    const entry = getEntry(req.params.id);
    if (!entry) return reply.status(404).send({ error: 'run not found' });
    return { run: entry.run, events: entry.events };
  });

  app.get<{ Params: { id: string } }>('/runs/:id/stream', async (req, reply) => {
    const entry = getEntry(req.params.id);
    if (!entry) return reply.status(404).send({ error: 'run not found' });
    startSse(reply);
    // replay buffered events
    for (const ev of entry.events) sendSse(reply, 'event', ev);
    sendSse(reply, 'state', entry.run);

    if (entry.run.status === 'completed' || entry.run.status === 'failed') {
      sendSse(reply, 'end', entry.run);
      reply.raw.end();
      return reply;
    }

    const onEvent = (ev: PipelineEvent) => sendSse(reply, 'event', ev);
    const onEnd = () => {
      sendSse(reply, 'end', entry.run);
      cleanup();
      reply.raw.end();
    };
    const onClose = () => cleanup();

    function cleanup() {
      entry!.emitter.off('event', onEvent);
      entry!.emitter.off('end', onEnd);
      req.raw.off('close', onClose);
    }

    entry.emitter.on('event', onEvent);
    entry.emitter.on('end', onEnd);
    req.raw.on('close', onClose);

    return reply;
  });

  app.post<{ Body: RunRequest }>('/rounds/run', async (req, reply) => {
    const body = req.body;
    const validation = validateRunRequest(body);
    if (validation) return reply.status(400).send({ error: validation });

    const project = await projectStore.get(body.project_id);
    if (!project) return reply.status(404).send({ error: 'project not found' });

    if (activeRunId()) {
      return reply
        .status(409)
        .send({ error: 'another run is in progress', active: activeRunId() });
    }

    if (!body.dry_run) {
      const probe = await checkClaudeAvailable();
      if (!probe.ok) {
        return reply.status(412).send({
          error: `claude CLI not available: ${probe.error ?? 'unknown'}`,
        });
      }
    }

    const entry = createRun(body);
    setActive(entry.run.id);

    const plan: RunPlan = {
      project,
      persona: body.persona,
      sections: body.sections,
      rounds: body.rounds,
      model: body.model,
      dryRun: body.dry_run === true,
    };

    setStatus(entry.run.id, 'running');
    void runRunInBackground(entry, plan);

    return reply.status(202).send({ run_id: entry.run.id });
  });

  app.post<{ Params: { id: string } }>('/runs/:id/cancel', async (req, reply) => {
    const entry = getEntry(req.params.id);
    if (!entry) return reply.status(404).send({ error: 'run not found' });
    if (entry.run.status !== 'running' && entry.run.status !== 'queued') {
      return reply.status(409).send({ error: `run already ${entry.run.status}` });
    }
    entry.abort.abort();
    pushEvent(entry.run.id, {
      stage: 'done',
      type: 'log',
      level: 'yellow',
      msg: '취소 요청됨…',
      ts: Date.now(),
    });
    return { ok: true as const };
  });
};

async function runRunInBackground(
  entry: Entry,
  plan: Parameters<typeof runPipeline>[0],
): Promise<void> {
  try {
    const roundIds = await runPipeline(
      plan,
      (ev) => pushEvent(entry.run.id, ev),
      entry.abort.signal,
    );
    finishRun(entry.run.id, { status: 'completed', round_ids: roundIds });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const wasAborted = entry.abort.signal.aborted;
    if (wasAborted) {
      pushEvent(entry.run.id, {
        stage: 'done',
        type: 'log',
        level: 'yellow',
        msg: '✗ 취소됨',
        ts: Date.now(),
      });
      finishRun(entry.run.id, { status: 'canceled', error: msg });
    } else {
      pushEvent(entry.run.id, {
        stage: 'done',
        type: 'error',
        msg,
        ts: Date.now(),
      });
      finishRun(entry.run.id, { status: 'failed', error: msg });
    }
  } finally {
    if (activeRunId() === entry.run.id) setActive(null);
  }
}

function validateRunRequest(body: RunRequest | undefined): string | null {
  if (!body) return 'body required';
  if (!body.project_id) return 'project_id required';
  if (!ALLOWED_PERSONAS.has(body.persona)) return `persona must be one of ${[...ALLOWED_PERSONAS].join(', ')}`;
  if (!ALLOWED_MODELS.has(body.model)) return `model must be one of ${[...ALLOWED_MODELS].join(', ')}`;
  if (!Array.isArray(body.sections) || body.sections.length === 0) return 'sections must be non-empty';
  const rounds = Number(body.rounds);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20)
    return 'rounds must be an integer between 1 and 20';
  return null;
}

function startSse(reply: FastifyReply) {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
}

function sendSse(reply: FastifyReply, type: string, data: unknown) {
  reply.raw.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}
