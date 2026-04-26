import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  BlindKind,
  Decision,
  ModelTier,
  Persona,
  RoundSummary,
  Side,
} from '@paper-refine/shared';

const ROUND_DIR_RE = /^(\d{8})_(\d{6})_round_(\d{3})$/;
const VERDICT_BLOCK_RE =
  /^## (R\d+)(?:-(\d+))?([^\n]*)\n([\s\S]*?)(?=\n## R\d+|\n## 요약|\n---|$)/gm;
const PICK_RE = /선택\s*→\s*\*\*([AB])\*\*/;
const SECTION_FILE_RE = /(\d{2}_\w+\.tex)/g;

export type RoundMetaFile = {
  persona?: Persona;
  model?: ModelTier;
  section?: string;
  /** Sections targeted in this round (when more than one). */
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
  // Treat as local; convert to ISO using current zone.
  const isoLocal = new Date(`${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}`).toISOString();
  return { ts: isoLocal, display_ts };
}

async function readJsonIfExists<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readTextIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return null;
  }
}

type MappingEntry = { rid: string; mapping: Record<Side, BlindKind> };

function parseMapping(text: string | null): MappingEntry[] {
  if (!text) return [];
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [ridPart, rest] = line.split(':');
      if (!ridPart || !rest) return null;
      const map: Partial<Record<Side, BlindKind>> = {};
      for (const seg of rest.split(',')) {
        const [k, v] = seg.split('=');
        if ((k === 'A' || k === 'B') && (v === 'original' || v === 'modified')) {
          map[k] = v;
        }
      }
      if (!map.A || !map.B) return null;
      return { rid: ridPart, mapping: map as Record<Side, BlindKind> };
    })
    .filter((x): x is MappingEntry => x !== null);
}

type Pick = { rid: string; occurrence: number; pick: Side };

function parseVerdictPicks(text: string | null): Pick[] {
  if (!text) return [];
  const out: Pick[] = [];
  const occurrences: Record<string, number> = {};
  let m: RegExpExecArray | null;
  VERDICT_BLOCK_RE.lastIndex = 0;
  while ((m = VERDICT_BLOCK_RE.exec(text)) !== null) {
    const rid = m[1]!;
    const declared = m[2];
    const headerTail = m[3] ?? '';
    const body = m[4] ?? '';
    const pickMatch = (headerTail + '\n' + body).match(PICK_RE);
    if (!pickMatch) continue;
    const occurrence = declared
      ? Number(declared)
      : (occurrences[rid] = (occurrences[rid] ?? 0) + 1);
    if (declared) {
      occurrences[rid] = Math.max(occurrences[rid] ?? 0, occurrence);
    }
    out.push({ rid, occurrence, pick: pickMatch[1] as Side });
  }
  return out;
}

/** Returns distinct section files mentioned in the review/changes texts. */
function inferSections(reviewText: string | null, changesText: string | null): string[] {
  const found = new Set<string>();
  for (const text of [reviewText, changesText]) {
    if (!text) continue;
    SECTION_FILE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = SECTION_FILE_RE.exec(text)) !== null) {
      found.add(m[1]!);
    }
  }
  return [...found].sort();
}

function pickRecommendedModified(picks: Pick[], mapping: MappingEntry[]): number {
  // Mapping entries are in source order (matching pipeline emission).
  // For repeated rids, the n-th mapping entry corresponds to the n-th
  // occurrence of that rid in the verdict.
  const buckets: Record<string, MappingEntry[]> = {};
  for (const m of mapping) {
    (buckets[m.rid] ??= []).push(m);
  }
  let modified = 0;
  for (const p of picks) {
    const bucket = buckets[p.rid];
    const entry = bucket?.[p.occurrence - 1] ?? bucket?.[0];
    if (entry?.mapping[p.pick] === 'modified') modified++;
  }
  return modified;
}

async function buildSummary(
  dir: string,
  dirName: string,
  projectId: string,
): Promise<RoundSummary | null> {
  const parsed = parseDirName(dirName);
  if (!parsed) return null;

  const [meta, mappingText, verdictText, reviewText, changesText, decisions] =
    await Promise.all([
      readJsonIfExists<RoundMetaFile>(path.join(dir, 'meta.json')),
      readTextIfExists(path.join(dir, '3_mapping.txt')),
      readTextIfExists(path.join(dir, '4_verdict.md')),
      readTextIfExists(path.join(dir, '1_review.md')),
      readTextIfExists(path.join(dir, '2_changes.md')),
      readJsonIfExists<Record<string, Decision>>(path.join(dir, 'decisions.json')),
    ]);

  const mapping = parseMapping(mappingText);
  const picks = parseVerdictPicks(verdictText);
  const decisionsList = Object.values(decisions ?? {});
  const itemCount = Math.max(picks.length, mapping.length);

  let section = meta?.section ?? '';
  if (!section) {
    const sections = meta?.sections ?? inferSections(reviewText, changesText);
    section = sections.length === 0 ? '?' : sections.length === 1 ? sections[0]! : 'multi';
  }

  return {
    id: dirName,
    ts: parsed.ts,
    display_ts: parsed.display_ts,
    project_id: projectId,
    section,
    persona: meta?.persona ?? null,
    model: meta?.model ?? null,
    status: picks.length > 0 ? 'completed' : 'in-progress',
    itemCount,
    decided: decisionsList.filter((d) => d.state !== 'pending').length,
    applyCount: decisionsList.filter((d) => d.state === 'apply').length,
    skipCount: decisionsList.filter((d) => d.state === 'skip').length,
    rejectCount: decisionsList.filter((d) => d.state === 'reject').length,
    pendingCount:
      itemCount > 0 ? Math.max(0, itemCount - decisionsList.filter((d) => d.state !== 'pending').length) : 0,
    recommendedModified: pickRecommendedModified(picks, mapping),
  };
}

export async function listRoundsInDir(
  outputDir: string,
  projectId: string,
): Promise<RoundSummary[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(outputDir);
  } catch {
    return [];
  }
  const summaries: RoundSummary[] = [];
  for (const name of entries) {
    const dir = path.join(outputDir, name);
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
  // newest first
  summaries.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  return summaries;
}
