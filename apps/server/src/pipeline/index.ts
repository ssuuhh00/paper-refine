import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  ModelTier,
  Persona,
  PipelineEvent,
  PipelineStage,
  Project,
  Side,
} from '@paper-refine/shared';
import { runClaude } from './claude.js';
import { loadDiscriminatorPrompt, loadGeneratorPrompt, loadReviewerPrompt } from './prompts.js';
import { buildBlindTest, parseChangesItems } from './shuffle.js';
import { parseRBlocks } from '../parse/sections.js';
import { extractContext } from '../util/context.js';

export type RunPlan = {
  project: Project;
  persona: Persona;
  sections: string[];
  rounds: number;
  model: ModelTier;
  dryRun: boolean;
};

export type EmitFn = (e: PipelineEvent) => void;

const PICK_RE = /선택\s*→\s*\*\*([AB])\*\*/;

function ts(): number {
  return Date.now();
}

function pad(n: number, w: number): string {
  return String(n).padStart(w, '0');
}

function compactTimestamp(d = new Date()): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1, 2)}${pad(d.getDate(), 2)}` +
    `_${pad(d.getHours(), 2)}${pad(d.getMinutes(), 2)}${pad(d.getSeconds(), 2)}`
  );
}

async function readSection(latexRoot: string, sec: string): Promise<string> {
  try {
    return await fs.readFile(path.join(latexRoot, 'sections', sec), 'utf8');
  } catch {
    return await fs.readFile(path.join(latexRoot, sec), 'utf8');
  }
}

async function buildPaperInput(latexRoot: string, sections: string[]): Promise<string> {
  const parts: string[] = [];
  for (const sec of sections) {
    const body = await readSection(latexRoot, sec);
    parts.push(`\n## 섹션: ${sec}\n\n\`\`\`latex\n${body}\n\`\`\`\n\n---\n`);
  }
  return parts.join('');
}

type LogLevel = 'dim' | 'norm' | 'cyan' | 'green' | 'yellow' | 'red';
function log(emit: EmitFn, stage: PipelineStage, level: LogLevel, msg: string) {
  emit({ stage, type: 'log', level, msg, ts: ts() });
}

async function ensureErrorNotes(notesPath: string): Promise<string> {
  try {
    return await fs.readFile(notesPath, 'utf8');
  } catch {
    const seed =
      '# 오답노트 (Error Notes)\n\nGenerator가 참고할 수 있는 이전 라운드의 거부 피드백 모음.\n\n---\n\n';
    await fs.mkdir(path.dirname(notesPath), { recursive: true });
    await fs.writeFile(notesPath, seed, 'utf8');
    return seed;
  }
}

async function runOneRound(
  plan: RunPlan,
  roundIdx: number,
  emit: EmitFn,
  signal: AbortSignal,
): Promise<string> {
  const { project, persona, sections, model } = plan;
  const roundId = `${compactTimestamp()}_round_${pad(roundIdx, 3)}`;
  const roundDir = path.join(project.output_dir, roundId);
  await fs.mkdir(roundDir, { recursive: true });

  const tag = `[round ${roundIdx}/${plan.rounds}]`;
  log(emit, 'review', 'cyan', `${tag} ${roundId}`);
  log(emit, 'review', 'dim', `섹션 ${sections.length}개 · ${persona} · ${model}`);

  // Always re-read sections so the prior round's edits can show up. (When we
  // wire Apply, this matters; for now both behaviors are equivalent.)
  const paperInput = await buildPaperInput(project.latex_root, sections);

  // Stash run metadata so the dashboard/workspace can recover persona/model/sections.
  const meta = {
    persona,
    model,
    section: sections.length === 1 ? sections[0] : 'multi',
    sections,
  };
  await fs.writeFile(path.join(roundDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

  // ── Step 1 — Reviewer ──────────────────────────────────────
  log(emit, 'review', 'cyan', `${tag} [1/4] Reviewer (${persona})`);
  const reviewerSys = await loadReviewerPrompt(persona);
  const reviewerInput =
    `# 리뷰 대상 논문\n\n` +
    `아래 섹션들을 전체적으로 리뷰해주세요.\n` +
    `각 리뷰 항목에 해당 섹션 파일명을 반드시 명시해주세요.\n\n` +
    paperInput;
  const reviewMd = await runClaude({
    model,
    systemPrompt: reviewerSys,
    input: reviewerInput,
    signal,
    onChunk: (chunk, stream) => {
      if (stream === 'stderr') log(emit, 'review', 'red', chunk.trimEnd());
    },
  });
  await fs.writeFile(path.join(roundDir, '1_review.md'), reviewMd, 'utf8');
  const reviewBlocks = parseRBlocks(reviewMd);
  for (const b of reviewBlocks) {
    const tail = b.headerTail.trim();
    emit({
      stage: 'review',
      type: 'item',
      r: b.rid,
      ts: ts(),
      ...(tail ? { title: tail } : {}),
    });
  }
  log(emit, 'review', 'green', `${tag} ✓ ${reviewBlocks.length}개 R 항목`);

  // ── Step 2 — Generator ─────────────────────────────────────
  log(emit, 'changes', 'cyan', `${tag} [2/4] Generator`);
  const generatorSys = await loadGeneratorPrompt();
  const errorNotes = await ensureErrorNotes(project.error_notes_path);
  const generatorInput =
    `## 리뷰 결과\n\n${reviewMd}\n\n---\n\n# 원본 논문 섹션들\n\n${paperInput}` +
    (errorNotes.trim() ? `\n\n---\n\n## 오답노트 (이전 라운드 참고용)\n\n${errorNotes}` : '');
  const changesMd = await runClaude({
    model,
    systemPrompt: generatorSys,
    input: generatorInput,
    signal,
    onChunk: (chunk, stream) => {
      if (stream === 'stderr') log(emit, 'changes', 'red', chunk.trimEnd());
    },
  });
  await fs.writeFile(path.join(roundDir, '2_changes.md'), changesMd, 'utf8');

  // Build 2_changes.json with surrounding context so the workspace can render
  // blind candidates inside their .tex flow without re-reading section files
  // at view time.
  const changesItems = parseChangesItems(changesMd);
  const sectionTexts: Record<string, string> = {};
  for (const sec of new Set(
    changesItems
      .map((it) => it.headerTail.match(/(\d{2}_\w+\.tex)/)?.[1])
      .filter((s): s is string => !!s),
  )) {
    try {
      sectionTexts[sec] = await readSection(project.latex_root, sec);
    } catch {
      // ignore
    }
  }
  const changesJson = changesItems.map((it) => {
    const sec = it.headerTail.match(/(\d{2}_\w+\.tex)/)?.[1] ?? null;
    const ctx = sec && sectionTexts[sec]
      ? extractContext(sectionTexts[sec]!, it.original, it.modified)
      : null;
    emit({ stage: 'changes', type: 'pair', r: it.rid, ts: ts() });
    return {
      key: `${it.rid}#${it.occurrence}`,
      rid: it.rid,
      occurrence: it.occurrence,
      section: sec,
      original: it.original,
      modified: it.modified,
      context: ctx,
    };
  });
  await fs.writeFile(
    path.join(roundDir, '2_changes.json'),
    JSON.stringify(changesJson, null, 2),
    'utf8',
  );
  log(emit, 'changes', 'green', `${tag} ✓ ${changesItems.length}개 수정 쌍`);

  // ── Step 3 — Blind shuffle ─────────────────────────────────
  log(emit, 'blind', 'cyan', `${tag} [3/4] Blind shuffle`);
  const shuffle = buildBlindTest(changesItems);
  await fs.writeFile(path.join(roundDir, '3_blind_test.md'), shuffle.blindMd, 'utf8');
  await fs.writeFile(path.join(roundDir, '3_mapping.txt'), shuffle.mappingTxt, 'utf8');
  for (const p of shuffle.picks) {
    emit({ stage: 'blind', type: 'map', r: p.rid, mapping: p.mapping, ts: ts() });
  }
  log(emit, 'blind', 'green', `${tag} ✓ ${shuffle.picks.length}개 매핑`);

  // ── Step 4 — Discriminator ─────────────────────────────────
  log(emit, 'verdict', 'cyan', `${tag} [4/4] Discriminator (블라인드)`);
  const discriminatorSys = await loadDiscriminatorPrompt();
  const discriminatorInput =
    `## 블라인드 테스트\n\n${shuffle.blindMd}\n\n---\n\n# 전체 논문 문맥 (참고용)\n\n${paperInput}`;
  const verdictMd = await runClaude({
    model,
    systemPrompt: discriminatorSys,
    input: discriminatorInput,
    signal,
    onChunk: (chunk, stream) => {
      if (stream === 'stderr') log(emit, 'verdict', 'red', chunk.trimEnd());
    },
  });
  await fs.writeFile(path.join(roundDir, '4_verdict.md'), verdictMd, 'utf8');

  const verdictBlocks = parseRBlocks(verdictMd);
  for (const b of verdictBlocks) {
    const pick = (b.headerTail + '\n' + b.body).match(PICK_RE)?.[1] as Side | undefined;
    if (pick) emit({ stage: 'verdict', type: 'pick', r: b.rid, pick, ts: ts() });
  }
  log(emit, 'verdict', 'green', `${tag} ✓ ${verdictBlocks.length}개 판정`);

  return roundId;
}

export async function runPipeline(
  plan: RunPlan,
  emit: EmitFn,
  signal: AbortSignal,
): Promise<string[]> {
  if (plan.dryRun) {
    log(emit, 'review', 'cyan', '=== Dry Run ===');
    log(emit, 'review', 'norm', `프로젝트       : ${plan.project.name}`);
    log(emit, 'review', 'norm', `LaTeX 루트     : ${plan.project.latex_root}`);
    log(emit, 'review', 'norm', `섹션           : ${plan.sections.join(', ')}`);
    log(emit, 'review', 'norm', `페르소나       : ${plan.persona}`);
    log(emit, 'review', 'norm', `라운드 수      : ${plan.rounds}`);
    log(emit, 'review', 'norm', `모델           : ${plan.model}`);
    log(emit, 'review', 'norm', `출력 디렉토리  : ${plan.project.output_dir}`);
    log(emit, 'review', 'norm', `오답노트       : ${plan.project.error_notes_path}`);
    log(emit, 'done', 'green', '✓ dry-run 완료 (실 호출 없음)');
    emit({ stage: 'done', type: 'complete', round_id: 'dry-run', ts: ts() });
    return [];
  }

  const roundIds: string[] = [];
  for (let i = 1; i <= plan.rounds; i++) {
    const id = await runOneRound(plan, i, emit, signal);
    roundIds.push(id);
    emit({ stage: 'done', type: 'complete', round_id: id, ts: ts() });
  }
  log(emit, 'done', 'green', `✓ 전체 ${plan.rounds}라운드 완료`);
  return roundIds;
}
