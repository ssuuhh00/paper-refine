import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  BlindFile,
  Decision,
  DiscriminatorOutput,
  ItemContext,
  ModelTier,
  Persona,
  Project,
  ReviewerOutput,
  Round,
  RoundItem,
  RoundSummary,
} from '@paper-refine/shared';
import { extractContext } from '../util/context.js';

const ROUND_DIR_RE = /^(\d{8})_(\d{6})_round_(\d{3})$/;

export type RoundMetaFile = {
  persona?: Persona;
  model?: ModelTier;
  section?: string;
  sections?: string[];
};

function parseDirName(name: string): { ts: string; display_ts: string } | null {
  const m = name.match(ROUND_DIR_RE);
  if (!m) return null;
  const ymd = m[1]!;
  const hms = m[2]!;
  const yyyy = ymd.slice(0, 4);
  const mm = ymd.slice(4, 6);
  const dd = ymd.slice(6, 8);
  const HH = hms.slice(0, 2);
  const MM = hms.slice(2, 4);
  const SS = hms.slice(4, 6);
  const display_ts = `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
  const ts = new Date(`${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}`).toISOString();
  return { ts, display_ts };
}

async function readJsonIfExists<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8')) as T;
  } catch {
    return null;
  }
}

/**
 * `2_changes.json` may be either the new shape `{ items: RoundItem[] }` or the
 * legacy flat array we used during the markdown-era. Returns null on either
 * malformed JSON or unrecognized shape.
 */
type ChangesFile = { items: RoundItem[]; summary?: string };

async function readChangesFile(p: string): Promise<ChangesFile | null> {
  const raw = await readJsonIfExists<unknown>(p);
  if (!raw) return null;
  if (Array.isArray(raw)) return null; // legacy — ignore
  if (typeof raw === 'object' && raw !== null && 'items' in raw && Array.isArray((raw as ChangesFile).items)) {
    return raw as ChangesFile;
  }
  return null;
}

async function loadSectionTexts(
  latexRoot: string,
  files: Set<string>,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    [...files].map(async (sec) => {
      try {
        out[sec] = await fs.readFile(path.join(latexRoot, 'sections', sec), 'utf8');
      } catch {
        try {
          out[sec] = await fs.readFile(path.join(latexRoot, sec), 'utf8');
        } catch {
          // ignore
        }
      }
    }),
  );
  return out;
}

/** Pick a primary section label for the round from its items. */
function deriveSection(items: RoundItem[], metaSection?: string): string {
  if (metaSection) return metaSection;
  const set = new Set<string>();
  for (const it of items) for (const e of it.edits) set.add(e.file);
  if (set.size === 0) return '?';
  if (set.size === 1) return [...set][0]!;
  return 'multi';
}

async function buildSummary(
  dir: string,
  dirName: string,
  projectId: string,
): Promise<RoundSummary | null> {
  const parsed = parseDirName(dirName);
  if (!parsed) return null;

  const [meta, changes, decisions, blind] = await Promise.all([
    readJsonIfExists<RoundMetaFile>(path.join(dir, 'meta.json')),
    readChangesFile(path.join(dir, '2_changes.json')),
    readJsonIfExists<Record<string, Decision>>(path.join(dir, 'decisions.json')),
    readJsonIfExists<BlindFile>(path.join(dir, '3_blind.json')),
  ]);

  // Items always come from 2_changes.json. If absent, the round is either
  // legacy (markdown only) or in-progress — surface a minimal summary so the
  // dashboard at least lists it.
  const items = changes?.items ?? [];
  const decisionsList = Object.values(decisions ?? {});
  const itemCount = items.length;
  const editCount = items.reduce((a, b) => a + (b.edits?.length ?? 0), 0);

  let recommendedModified = 0;
  if (blind && items.length > 0) {
    const blindByR = new Map(blind.items.map((b) => [b.r, b.mapping]));
    for (const it of items) {
      const map = blindByR.get(it.r) ?? it.blind;
      const pickKind = map?.[it.verdict.pick];
      if (pickKind === 'modified') recommendedModified++;
    }
  } else {
    for (const it of items) {
      if (it.blind?.[it.verdict.pick] === 'modified') recommendedModified++;
    }
  }

  const status: RoundSummary['status'] =
    items.length === 0
      ? 'in-progress'
      : items.every((it) => it.verdict.reason || it.verdict.loserReason)
        ? 'completed'
        : 'in-progress';

  return {
    id: dirName,
    ts: parsed.ts,
    display_ts: parsed.display_ts,
    project_id: projectId,
    section: deriveSection(items, meta?.section),
    persona: meta?.persona ?? null,
    model: meta?.model ?? null,
    status,
    itemCount,
    editCount,
    decided: decisionsList.filter((d) => d.state !== 'pending').length,
    applyCount: decisionsList.filter((d) => d.state === 'apply').length,
    skipCount: decisionsList.filter((d) => d.state === 'skip').length,
    rejectCount: decisionsList.filter((d) => d.state === 'reject').length,
    pendingCount: Math.max(
      0,
      itemCount - decisionsList.filter((d) => d.state !== 'pending').length,
    ),
    recommendedModified,
  };
}

export async function listRoundsInDir(
  outputDir: string,
  projectId: string,
): Promise<RoundSummary[]> {
  const roundsDir = path.join(outputDir, 'rounds');
  let entries: string[];
  try {
    entries = await fs.readdir(roundsDir);
  } catch {
    return [];
  }
  const summaries: RoundSummary[] = [];
  for (const name of entries) {
    const dir = path.join(roundsDir, name);
    let isDir = false;
    try {
      isDir = (await fs.stat(dir)).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;
    const summary = await buildSummary(dir, name, projectId);
    if (summary) summaries.push(summary);
  }
  summaries.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  return summaries;
}

/** Full round detail — JSON files merged with decisions.json, context backfilled. */
export async function loadFullRound(
  project: Project,
  roundId: string,
): Promise<Round | null> {
  const dir = path.join(project.output_dir, 'rounds', roundId);
  const parsed = parseDirName(roundId);
  if (!parsed) return null;
  let stat;
  try {
    stat = await fs.stat(dir);
  } catch {
    return null;
  }
  if (!stat.isDirectory()) return null;

  const [meta, review, changes, blind, verdict, decisions] = await Promise.all([
    readJsonIfExists<RoundMetaFile>(path.join(dir, 'meta.json')),
    readJsonIfExists<ReviewerOutput>(path.join(dir, '1_review.json')),
    readChangesFile(path.join(dir, '2_changes.json')),
    readJsonIfExists<BlindFile>(path.join(dir, '3_blind.json')),
    readJsonIfExists<DiscriminatorOutput>(path.join(dir, '4_verdict.json')),
    readJsonIfExists<Record<string, Decision>>(path.join(dir, 'decisions.json')),
  ]);

  if (!changes) {
    return {
      id: roundId,
      ts: parsed.ts,
      project_id: project.id,
      section: meta?.section ?? '?',
      persona: meta?.persona ?? null,
      model: meta?.model ?? null,
      status: 'in-progress',
      items: [],
      decisions: {},
    };
  }

  // Items from changes.json are the source of truth — backfill blind/verdict
  // from their own files in case 2_changes.json was written before stages
  // 3/4 finished (defensive: index.ts re-writes it after verdict, but we
  // shouldn't trust order if a previous run was interrupted).
  const blindByR = new Map(blind?.items.map((b) => [b.r, b.mapping]) ?? []);
  const verdictByR = new Map(verdict?.items.map((v) => [v.r, v]) ?? []);
  const reviewByR = new Map(review?.items.map((r) => [r.r, r]) ?? []);

  // Refill ItemContext when missing (older rounds may not have it on disk).
  const filesNeedingCtx = new Set<string>();
  for (const it of changes.items) {
    for (const e of it.edits ?? []) {
      if (!e.context && e.file) filesNeedingCtx.add(e.file);
    }
  }
  const sectionTexts = filesNeedingCtx.size > 0
    ? await loadSectionTexts(project.latex_root, filesNeedingCtx)
    : {};

  const items: RoundItem[] = changes.items.map((raw) => {
    const reviewItem = reviewByR.get(raw.r);
    const blindMap = blindByR.get(raw.r) ?? raw.blind ?? { A: 'original', B: 'modified' };
    const v = verdictByR.get(raw.r);
    const edits = (raw.edits ?? []).map((e) => {
      let context: ItemContext | undefined = e.context;
      if (!context && sectionTexts[e.file]) {
        const ctx = extractContext(sectionTexts[e.file]!, e.original, e.modified);
        if (ctx) context = ctx;
      }
      return {
        file: e.file,
        original: e.original,
        modified: e.modified,
        ...(context ? { context } : {}),
      };
    });
    return {
      r: raw.r,
      key: raw.r,
      title: raw.title || reviewItem?.title || raw.rule || '',
      ...(raw.severity || reviewItem?.severity
        ? { severity: (raw.severity ?? reviewItem?.severity) as RoundItem['severity'] }
        : {}),
      concern: raw.concern || reviewItem?.concern || '',
      citations: raw.citations?.length ? raw.citations : (reviewItem?.citations ?? []),
      rule: raw.rule || '',
      rationale: raw.rationale || '',
      edits,
      blind: blindMap,
      verdict: v
        ? { pick: v.pick, reason: v.reason, loserReason: v.loserReason }
        : raw.verdict ?? { pick: 'A', reason: '', loserReason: '' },
    };
  });

  const decisionsOut: Record<string, Decision> = { ...(decisions ?? {}) };
  for (const it of items) {
    if (!decisionsOut[it.r]) decisionsOut[it.r] = { state: 'pending' };
  }
  for (const k of Object.keys(decisionsOut)) {
    if (!items.find((i) => i.r === k)) {
      delete decisionsOut[k];
    }
  }

  const status: Round['status'] =
    items.length === 0
      ? 'in-progress'
      : items.every((it) => it.verdict.reason || it.verdict.loserReason)
        ? 'completed'
        : 'in-progress';

  return {
    id: roundId,
    ts: parsed.ts,
    project_id: project.id,
    section: deriveSection(items, meta?.section),
    persona: meta?.persona ?? null,
    model: meta?.model ?? null,
    status,
    items,
    decisions: decisionsOut,
    ...(verdict?.summary || changes.summary
      ? { summary: verdict?.summary ?? changes.summary }
      : {}),
  };
}

export async function patchDecisions(
  project: Project,
  roundId: string,
  patch: Record<string, Decision>,
): Promise<Record<string, Decision>> {
  const dir = path.join(project.output_dir, 'rounds', roundId);
  const file = path.join(dir, 'decisions.json');
  let current: Record<string, Decision> = {};
  try {
    current = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    current = {};
  }
  const ts = new Date().toISOString();
  for (const [k, v] of Object.entries(patch)) {
    current[k] = { ...v, decided_at: v.decided_at ?? ts };
  }
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(current, null, 2), 'utf8');
  return current;
}

/** Recursively delete a round directory. */
export async function deleteRound(project: Project, roundId: string): Promise<boolean> {
  if (!roundId.match(ROUND_DIR_RE)) return false;
  const dir = path.join(project.output_dir, 'rounds', roundId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}
