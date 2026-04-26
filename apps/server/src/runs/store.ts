import { EventEmitter } from 'node:events';
import type { PipelineEvent, Run, RunRequest } from '@paper-refine/shared';

export type Entry = {
  run: Run;
  events: PipelineEvent[];
  emitter: EventEmitter;
  abort: AbortController;
};

const store = new Map<string, Entry>();
let activeId: string | null = null;

function newId(): string {
  return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function activeRunId(): string | null {
  return activeId;
}

export function createRun(req: RunRequest): Entry {
  const id = newId();
  const emitter = new EventEmitter();
  emitter.setMaxListeners(50);
  const entry: Entry = {
    run: {
      id,
      project_id: req.project_id,
      request: req,
      status: 'queued',
      started_at: new Date().toISOString(),
      round_ids: [],
    },
    events: [],
    emitter,
    abort: new AbortController(),
  };
  store.set(id, entry);
  return entry;
}

export function setActive(id: string | null): void {
  activeId = id;
}

export function getEntry(id: string): Entry | null {
  return store.get(id) ?? null;
}

export function listRuns(): Run[] {
  return [...store.values()]
    .map((e) => e.run)
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
}

export function pushEvent(id: string, ev: PipelineEvent): void {
  const e = store.get(id);
  if (!e) return;
  e.events.push(ev);
  e.emitter.emit('event', ev);
}

export function finishRun(
  id: string,
  patch: { status: Run['status']; round_ids?: string[]; error?: string },
): void {
  const e = store.get(id);
  if (!e) return;
  e.run.status = patch.status;
  e.run.finished_at = new Date().toISOString();
  if (patch.round_ids) e.run.round_ids = patch.round_ids;
  if (patch.error) e.run.error = patch.error;
  e.emitter.emit('end');
}

export function setStatus(id: string, status: Run['status']): void {
  const e = store.get(id);
  if (!e) return;
  e.run.status = status;
}
