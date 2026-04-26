import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  BlindKind,
  Decision,
  ItemContext,
  ModelTier,
  Persona,
  Project,
  Round,
  RoundItem,
  RoundSummary,
  Side,
} from '@paper-refine/shared';
import { extractSectionFile, itemKey, parseRBlocks, type ParsedBlock } from './sections.js';
import { extractContext } from '../util/context.js';

const ROUND_DIR_RE = /^(\d{8})_(\d{6})_round_(\d{3})$/;
const PICK_RE = /선택\s*→\s*\*\*([AB])\*\*/;
const REASON_RE = /\*\*사유\*\*\s*:\s*([\s\S]*?)(?=\n[-*]\s*\*\*|\n## |\n---|$)/;
const LOSER_RE = /\*\*탈락\s*sa?유\*\*\s*:\s*([\s\S]*?)(?=\n[-*]\s*\*\*|\n## |\n---|$)/;
const LOC_RE = /\*\*위치\*\*\s*:\s*([^\n]+)/;
const CITE_RE = /\*\*인용\*\*\s*:\s*([\s\S]*?)(?=\n[-*]\s*\*\*|\n## |$)/;
const ISSUE_RE = /\*\*지적\*\*\s*:\s*([\s\S]*?)(?=\n[-*]\s*\*\*|\n## |\n---|$)/;
const CODE_LATEX_RE = /```latex\n([\s\S]*?)```/g;
const RATIONALE_RE = /###\s*근거\s*\n([\s\S]*?)(?=\n###|\n## |\n---|$)/;
const SECTION_FILE_BARE = /^\d{2}_\w+\.tex$/;

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

async function readTextIfExists(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return null;
  }
}

type MappingEntry = { rid: string; occurrence: number; mapping: Record<Side, BlindKind> };

function parseMapping(text: string | null): MappingEntry[] {
  if (!text) return [];
  const counters: Record<string, number> = {};
  const out: MappingEntry[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const ridPart = line.slice(0, colon);
    const rest = line.slice(colon + 1);
    const ridMatch = ridPart.match(/^(R\d+)(?:-(\d+))?$/);
    if (!ridMatch) continue;
    const rid = ridMatch[1]!;
    const declared = ridMatch[2];
    const occurrence = declared ? Number(declared) : (counters[rid] = (counters[rid] ?? 0) + 1);
    if (declared) counters[rid] = Math.max(counters[rid] ?? 0, occurrence);
    const mapping: Partial<Record<Side, BlindKind>> = {};
    for (const seg of rest.split(',')) {
      const [k, v] = seg.split('=');
      if ((k === 'A' || k === 'B') && (v === 'original' || v === 'modified')) {
        mapping[k] = v;
      }
    }
    if (mapping.A && mapping.B) {
      out.push({ rid, occurrence, mapping: mapping as Record<Side, BlindKind> });
    }
  }
  return out;
}

function pickBlock(blocks: ParsedBlock[], rid: string, occurrence: number): ParsedBlock | null {
  return blocks.find((b) => b.rid === rid && b.occurrence === occurrence) ?? null;
}

function pickMapping(
  entries: MappingEntry[],
  rid: string,
  occurrence: number,
): MappingEntry | null {
  return (
    entries.find((m) => m.rid === rid && m.occurrence === occurrence) ??
    entries.find((m) => m.rid === rid) ??
    null
  );
}

function cleanTitle(headerTail: string): string {
  let t = headerTail.trim();
  // strip leading colon/dash/em-dash decorations
  t = t.replace(/^[:\-—\s]+/, '');
  // strip the verdict-style "선택 → **A**" tail, keeping any preceding label
  t = t.replace(/\s*[:：]?\s*선택\s*→.*$/, '');
  // strip trailing " — section.tex" pointer
  t = t.replace(/\s*—\s*\d{2}_\w+\.tex\s*$/, '');
  t = t.trim();
  // a header tail that is *only* a section file (e.g. "## R3 — 04_evaluation.tex"
  // in changes.md) carries no title — the title lives in the review header.
  if (SECTION_FILE_BARE.test(t)) return '';
  return t;
}

function pickFirst(re: RegExp, text: string): string {
  const m = text.match(re);
  return m?.[1]?.trim() ?? '';
}

function parseChangesPair(body: string): { original: string; modified: string } {
  CODE_LATEX_RE.lastIndex = 0;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = CODE_LATEX_RE.exec(body)) !== null) {
    blocks.push(m[1]!.trim());
  }
  return { original: blocks[0] ?? '', modified: blocks[1] ?? '' };
}

function parseCite(body: string): string {
  return pickFirst(CITE_RE, body);
}

async function loadSectionTexts(
  latexRoot: string,
  sections: Set<string>,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    [...sections].map(async (sec) => {
      try {
        out[sec] = await fs.readFile(path.join(latexRoot, 'sections', sec), 'utf8');
      } catch {
        // try without sections/ prefix
        try {
          out[sec] = await fs.readFile(path.join(latexRoot, sec), 'utf8');
        } catch {
          // ignore — context will be omitted
        }
      }
    }),
  );
  return out;
}

async function buildSummary(
  dir: string,
  dirName: string,
  projectId: string,
): Promise<RoundSummary | null> {
  const parsed = parseDirName(dirName);
  if (!parsed) return null;

  const [meta, mappingText, verdictText, reviewText, changesText, decisions] = await Promise.all([
    readJsonIfExists<RoundMetaFile>(path.join(dir, 'meta.json')),
    readTextIfExists(path.join(dir, '3_mapping.txt')),
    readTextIfExists(path.join(dir, '4_verdict.md')),
    readTextIfExists(path.join(dir, '1_review.md')),
    readTextIfExists(path.join(dir, '2_changes.md')),
    readJsonIfExists<Record<string, Decision>>(path.join(dir, 'decisions.json')),
  ]);

  const mapping = parseMapping(mappingText);
  const verdictBlocks = parseRBlocks(verdictText);
  const decisionsList = Object.values(decisions ?? {});
  const itemCount = Math.max(verdictBlocks.length, mapping.length);

  let recommendedModified = 0;
  for (const b of verdictBlocks) {
    const pickMatch = (b.headerTail + '\n' + b.body).match(PICK_RE);
    if (!pickMatch) continue;
    const map = pickMapping(mapping, b.rid, b.occurrence);
    if (map?.mapping[pickMatch[1] as Side] === 'modified') recommendedModified++;
  }

  let section = meta?.section ?? '';
  if (!section) {
    const found = new Set<string>();
    for (const text of [reviewText, changesText]) {
      if (!text) continue;
      const re = /(\d{2}_\w+\.tex)/g;
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(text)) !== null) found.add(mm[1]!);
    }
    section = found.size === 0 ? '?' : found.size === 1 ? [...found][0]! : 'multi';
  }

  return {
    id: dirName,
    ts: parsed.ts,
    display_ts: parsed.display_ts,
    project_id: projectId,
    section,
    persona: meta?.persona ?? null,
    model: meta?.model ?? null,
    status: verdictBlocks.length > 0 ? 'completed' : 'in-progress',
    itemCount,
    decided: decisionsList.filter((d) => d.state !== 'pending').length,
    applyCount: decisionsList.filter((d) => d.state === 'apply').length,
    skipCount: decisionsList.filter((d) => d.state === 'skip').length,
    rejectCount: decisionsList.filter((d) => d.state === 'reject').length,
    pendingCount:
      itemCount > 0
        ? Math.max(0, itemCount - decisionsList.filter((d) => d.state !== 'pending').length)
        : 0,
    recommendedModified,
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
  summaries.sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  return summaries;
}

/** Full round detail — all 5 files merged into items with context. */
export async function loadFullRound(
  project: Project,
  roundId: string,
): Promise<Round | null> {
  const dir = path.join(project.output_dir, roundId);
  const parsed = parseDirName(roundId);
  if (!parsed) return null;
  let stat;
  try {
    stat = await fs.stat(dir);
  } catch {
    return null;
  }
  if (!stat.isDirectory()) return null;

  const [meta, mappingText, verdictText, reviewText, changesText, decisions] = await Promise.all([
    readJsonIfExists<RoundMetaFile>(path.join(dir, 'meta.json')),
    readTextIfExists(path.join(dir, '3_mapping.txt')),
    readTextIfExists(path.join(dir, '4_verdict.md')),
    readTextIfExists(path.join(dir, '1_review.md')),
    readTextIfExists(path.join(dir, '2_changes.md')),
    readJsonIfExists<Record<string, Decision>>(path.join(dir, 'decisions.json')),
  ]);

  const reviewBlocks = parseRBlocks(reviewText);
  const changesBlocks = parseRBlocks(changesText);
  const verdictBlocks = parseRBlocks(verdictText);
  const mapping = parseMapping(mappingText);

  // Union of (rid, occurrence) keys, ordered by first appearance in verdict → review → changes.
  const seen = new Set<string>();
  const order: { rid: string; occurrence: number }[] = [];
  const push = (b: { rid: string; occurrence: number }) => {
    const k = itemKey(b.rid, b.occurrence);
    if (seen.has(k)) return;
    seen.add(k);
    order.push({ rid: b.rid, occurrence: b.occurrence });
  };
  for (const list of [verdictBlocks, reviewBlocks, changesBlocks]) {
    for (const b of list) push(b);
  }
  for (const m of mapping) push(m);

  // Collect sections we need to read for context.
  const sections = new Set<string>();
  for (const b of changesBlocks) {
    const sec = extractSectionFile(b.headerTail, b.body);
    if (sec) sections.add(sec);
  }
  const sectionTexts = await loadSectionTexts(project.latex_root, sections);

  const items: RoundItem[] = order.map(({ rid, occurrence }) => {
    const r = pickBlock(reviewBlocks, rid, occurrence);
    const c = pickBlock(changesBlocks, rid, occurrence);
    const v = pickBlock(verdictBlocks, rid, occurrence);
    const m = pickMapping(mapping, rid, occurrence);

    const section =
      extractSectionFile(c?.headerTail, c?.body, r?.headerTail, r?.body) ?? '?';
    const title =
      cleanTitle(r?.headerTail ?? '') ||
      cleanTitle(c?.headerTail ?? '') ||
      cleanTitle(v?.headerTail ?? '');
    const cite = r ? parseCite(r.body) : '';
    const issue = r ? pickFirst(ISSUE_RE, r.body) : '';
    const location = r ? pickFirst(LOC_RE, r.body) : '';
    const { original, modified } = c ? parseChangesPair(c.body) : { original: '', modified: '' };
    const rationale = c ? pickFirst(RATIONALE_RE, c.body) : '';

    let pickSide: Side = 'A';
    let reason = '';
    let loserReason = '';
    if (v) {
      const pickMatch = (v.headerTail + '\n' + v.body).match(PICK_RE);
      if (pickMatch) pickSide = pickMatch[1] as Side;
      reason = pickFirst(REASON_RE, v.body);
      loserReason = pickFirst(LOSER_RE, v.body);
    }

    const blind: Record<Side, BlindKind> = m?.mapping ?? { A: 'original', B: 'modified' };

    let context: ItemContext | undefined;
    if ((original || modified) && sectionTexts[section]) {
      const ctx = extractContext(sectionTexts[section]!, original, modified);
      if (ctx) context = ctx;
    }

    return {
      r: rid,
      key: itemKey(rid, occurrence),
      occurrence,
      title,
      location,
      section,
      cite,
      issue,
      original,
      modified,
      rationale,
      blind,
      verdict: { pick: pickSide, reason, loserReason },
      ...(context ? { context } : {}),
    };
  });

  // Status / aggregates
  const decisionsList = Object.values(decisions ?? {});
  const status: Round['status'] = verdictBlocks.length > 0 ? 'completed' : 'in-progress';
  let primarySection = meta?.section ?? '';
  if (!primarySection) {
    const set = new Set(items.map((i) => i.section).filter((s) => s !== '?'));
    primarySection = set.size === 0 ? '?' : set.size === 1 ? [...set][0]! : 'multi';
  }

  // Mark missing decisions as pending so the UI gets a stable map.
  const decisionsOut: Record<string, Decision> = { ...(decisions ?? {}) };
  for (const it of items) {
    if (!decisionsOut[it.key]) decisionsOut[it.key] = { state: 'pending' };
  }

  // Filter the items->decisions to ensure no orphan keys leak into the UI.
  for (const k of Object.keys(decisionsOut)) {
    if (!items.find((i) => i.key === k)) {
      // Keep orphan decisions but attach unknown items would be confusing — drop them
      // from the response. (They remain on disk in case user re-runs the round.)
      delete decisionsOut[k];
    }
  }

  void decisionsList; // (silence unused)

  return {
    id: roundId,
    ts: parsed.ts,
    project_id: project.id,
    section: primarySection,
    persona: (meta?.persona ?? null) as Round['persona'],
    model: (meta?.model ?? null) as Round['model'],
    status,
    items,
    decisions: decisionsOut,
  };
}

/** Read+merge+write decisions.json for a single round. */
export async function patchDecisions(
  project: Project,
  roundId: string,
  patch: Record<string, Decision>,
): Promise<Record<string, Decision>> {
  const dir = path.join(project.output_dir, roundId);
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
