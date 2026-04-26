import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  Citation,
  DiscriminatorOutput,
  Edit,
  GeneratorOutput,
  ItemContext,
  ModelTier,
  Persona,
  PipelineEvent,
  PipelineStage,
  Project,
  ReviewerOutput,
  RoundItem,
} from '@paper-refine/shared';
import { runClaude, runClaudeJson } from './claude.js';
import { loadDiscriminatorPrompt, loadGeneratorPrompt, loadReviewerPrompt } from './prompts.js';
import { buildBlindTest, fromGeneratorOutput } from './shuffle.js';
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

// ── Markdown rendering for human-readable artifacts ──────────────────────────

function renderReviewMd(out: ReviewerOutput): string {
  const lines: string[] = ['# Review\n'];
  for (const it of out.items) {
    const sev = it.severity ? ` _(${it.severity})_` : '';
    lines.push(`\n## ${it.r}: ${it.title}${sev}\n`);
    lines.push(`- **Concern**: ${it.concern}`);
    if (it.citations.length > 0) {
      lines.push(`- **Citations** (${it.citations.length}):`);
      it.citations.forEach((c, i) => {
        const note = c.note ? ` — ${c.note}` : '';
        lines.push(`  ${i + 1}. \`${c.file}\`${note}`);
        lines.push('     ```latex');
        lines.push('     ' + c.snippet.split('\n').join('\n     '));
        lines.push('     ```');
      });
    }
  }
  return lines.join('\n') + '\n';
}

function renderChangesMd(items: RoundItem[]): string {
  const lines: string[] = ['# Changes\n'];
  for (const it of items) {
    lines.push(`\n## ${it.r} — ${it.rule}\n`);
    lines.push(`**Rationale**: ${it.rationale}\n`);
    if (it.edits.length === 0) {
      lines.push('_(no edits — generator chose to leave this R untouched)_\n');
      continue;
    }
    lines.push(`**Edits** (${it.edits.length}):\n`);
    it.edits.forEach((e, i) => {
      const num = it.edits.length > 1 ? `### ${i + 1}/${it.edits.length} ` : '### ';
      lines.push(`${num}\`${e.file}\`\n`);
      lines.push('**원문**\n');
      lines.push('```latex');
      lines.push(e.original);
      lines.push('```\n');
      lines.push('**수정**\n');
      lines.push('```latex');
      lines.push(e.modified);
      lines.push('```\n');
    });
  }
  return lines.join('\n');
}

function renderVerdictMd(out: DiscriminatorOutput, blindMap: Map<string, { A: string; B: string }>): string {
  const lines: string[] = ['# Verdict\n'];
  for (const it of out.items) {
    const map = blindMap.get(it.r);
    const pickKind = map ? map[it.r === 'A' ? 'A' : it.pick] : null;
    void pickKind;
    lines.push(`\n## ${it.r}: 선택 → **${it.pick}**${map ? ` _(=${map[it.pick]})_` : ''}\n`);
    lines.push(`- **사유**: ${it.reason}`);
    lines.push(`- **탈락 사유**: ${it.loserReason}`);
  }
  if (out.summary) {
    lines.push(`\n---\n\n## 요약\n\n${out.summary}\n`);
  }
  return lines.join('\n') + '\n';
}

// ── Per-round orchestration ──────────────────────────────────────────────────

async function runOneRound(
  plan: RunPlan,
  roundIdx: number,
  emit: EmitFn,
  signal: AbortSignal,
): Promise<string> {
  const { project, persona, sections, model } = plan;
  const roundId = `${compactTimestamp()}_round_${pad(roundIdx, 3)}`;
  const roundDir = path.join(project.output_dir, 'rounds', roundId);
  await fs.mkdir(roundDir, { recursive: true });

  const tag = `[round ${roundIdx}/${plan.rounds}]`;
  log(emit, 'review', 'cyan', `${tag} ${roundId}`);
  log(emit, 'review', 'dim', `섹션 ${sections.length}개 · ${persona} · ${model}`);

  const paperInput = await buildPaperInput(project.latex_root, sections);

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
    `아래 섹션들을 전체적으로 리뷰하여 시스템 프롬프트의 JSON 스키마에 맞게 응답하라.\n\n` +
    paperInput;

  const reviewerOut = await runClaudeJson<ReviewerOutput>({
    model,
    systemPrompt: reviewerSys,
    input: reviewerInput,
    signal,
    onChunk: (chunk, stream) => {
      if (stream === 'stderr') log(emit, 'review', 'red', chunk.trimEnd());
    },
  });

  await fs.writeFile(
    path.join(roundDir, '1_review.json'),
    JSON.stringify(reviewerOut, null, 2),
    'utf8',
  );
  await fs.writeFile(path.join(roundDir, '1_review.md'), renderReviewMd(reviewerOut), 'utf8');
  for (const b of reviewerOut.items) {
    emit({
      stage: 'review',
      type: 'item',
      r: b.r,
      title: b.title,
      ts: ts(),
    });
  }
  log(emit, 'review', 'green', `${tag} ✓ ${reviewerOut.items.length}개 R 항목`);

  // ── Step 2 — Generator ─────────────────────────────────────
  log(emit, 'changes', 'cyan', `${tag} [2/4] Generator`);
  const generatorSys = await loadGeneratorPrompt();
  const errorNotes = await ensureErrorNotes(project.error_notes_path);
  const generatorInput =
    `## 리뷰 결과 (JSON)\n\n\`\`\`json\n${JSON.stringify(reviewerOut, null, 2)}\n\`\`\`\n\n` +
    `---\n\n# 원본 논문 섹션들\n\n${paperInput}` +
    (errorNotes.trim()
      ? `\n\n---\n\n## 오답노트 (이전 라운드 참고용)\n\n${errorNotes}`
      : '');

  const generatorOut = await runClaudeJson<GeneratorOutput>({
    model,
    systemPrompt: generatorSys,
    input: generatorInput,
    signal,
    onChunk: (chunk, stream) => {
      if (stream === 'stderr') log(emit, 'changes', 'red', chunk.trimEnd());
    },
  });

  // Build the round's RoundItem list — merge reviewer + generator output and
  // attach .tex context per edit. We read each section once and reuse.
  const reviewerByR = new Map(reviewerOut.items.map((it) => [it.r, it]));
  const sectionTexts: Record<string, string> = {};
  const filesNeeded = new Set<string>();
  for (const it of generatorOut.items) for (const e of it.edits) filesNeeded.add(e.file);
  await Promise.all(
    [...filesNeeded].map(async (sec) => {
      try {
        sectionTexts[sec] = await readSection(project.latex_root, sec);
      } catch {
        // ignore — context will be omitted
      }
    }),
  );

  const items: RoundItem[] = generatorOut.items.map((g) => {
    const r = reviewerByR.get(g.r);
    const editsWithContext: Edit[] = g.edits.map((e) => {
      const src = sectionTexts[e.file];
      const ctx: ItemContext | null = src ? extractContext(src, e.original, e.modified) : null;
      return {
        file: e.file,
        original: e.original,
        modified: e.modified,
        ...(ctx ? { context: ctx } : {}),
      };
    });
    const citations: Citation[] = r?.citations ?? [];
    const item: RoundItem = {
      r: g.r,
      key: g.r,
      title: r?.title ?? g.rule,
      ...(r?.severity ? { severity: r.severity } : {}),
      concern: r?.concern ?? '',
      citations,
      rule: g.rule,
      rationale: g.rationale,
      edits: editsWithContext,
      blind: { A: 'original', B: 'modified' },
      verdict: { pick: 'A', reason: '', loserReason: '' },
    };
    emit({ stage: 'changes', type: 'pair', r: g.r, editCount: editsWithContext.length, ts: ts() });
    return item;
  });

  await fs.writeFile(
    path.join(roundDir, '2_changes.json'),
    JSON.stringify({ items }, null, 2),
    'utf8',
  );
  await fs.writeFile(path.join(roundDir, '2_changes.md'), renderChangesMd(items), 'utf8');
  log(
    emit,
    'changes',
    'green',
    `${tag} ✓ ${items.length}개 R · 총 ${items.reduce((a, b) => a + b.edits.length, 0)}개 edit`,
  );

  // ── Step 3 — Blind shuffle (R-level) ─────────────────────────
  log(emit, 'blind', 'cyan', `${tag} [3/4] Blind shuffle`);
  const shuffle = buildBlindTest(fromGeneratorOutput(generatorOut));
  await fs.writeFile(
    path.join(roundDir, '3_blind.json'),
    JSON.stringify(shuffle.blindFile, null, 2),
    'utf8',
  );
  await fs.writeFile(path.join(roundDir, '3_blind_test.md'), shuffle.blindMd, 'utf8');
  for (const p of shuffle.picks) {
    emit({ stage: 'blind', type: 'map', r: p.r, mapping: p.mapping, ts: ts() });
  }
  // attach blind mapping back into items
  const blindByR = new Map(shuffle.blindFile.items.map((b) => [b.r, b.mapping]));
  for (const it of items) {
    const m = blindByR.get(it.r);
    if (m) it.blind = m;
  }
  log(emit, 'blind', 'green', `${tag} ✓ ${shuffle.picks.length}개 매핑`);

  // ── Step 4 — Discriminator ─────────────────────────────────
  log(emit, 'verdict', 'cyan', `${tag} [4/4] Discriminator (블라인드)`);
  const discriminatorSys = await loadDiscriminatorPrompt();
  const discriminatorInput =
    `## 블라인드 테스트\n\n${shuffle.blindMd}\n\n---\n\n# 전체 논문 문맥 (참고용)\n\n${paperInput}`;

  const verdictOut = await runClaudeJson<DiscriminatorOutput>({
    model,
    systemPrompt: discriminatorSys,
    input: discriminatorInput,
    signal,
    onChunk: (chunk, stream) => {
      if (stream === 'stderr') log(emit, 'verdict', 'red', chunk.trimEnd());
    },
  });
  await fs.writeFile(
    path.join(roundDir, '4_verdict.json'),
    JSON.stringify(verdictOut, null, 2),
    'utf8',
  );
  const blindMapForRender = new Map(
    shuffle.blindFile.items.map((b) => [b.r, b.mapping] as const),
  );
  await fs.writeFile(
    path.join(roundDir, '4_verdict.md'),
    renderVerdictMd(verdictOut, blindMapForRender),
    'utf8',
  );

  // attach verdict back into items + emit events
  const verdictByR = new Map(verdictOut.items.map((v) => [v.r, v]));
  for (const it of items) {
    const v = verdictByR.get(it.r);
    if (v) {
      it.verdict = { pick: v.pick, reason: v.reason, loserReason: v.loserReason };
      emit({ stage: 'verdict', type: 'pick', r: it.r, pick: v.pick, ts: ts() });
    }
  }
  // re-write 2_changes.json now that we have blind + verdict glued onto items
  await fs.writeFile(
    path.join(roundDir, '2_changes.json'),
    JSON.stringify(
      {
        items,
        ...(verdictOut.summary ? { summary: verdictOut.summary } : {}),
      },
      null,
      2,
    ),
    'utf8',
  );
  log(emit, 'verdict', 'green', `${tag} ✓ ${verdictOut.items.length}개 판정`);

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

  // Touch runClaude so the symbol is referenced (it's used internally by
  // runClaudeJson, but TS would otherwise allow tree-shake removal in some
  // bundlers).
  void runClaude;

  const roundIds: string[] = [];
  for (let i = 1; i <= plan.rounds; i++) {
    const id = await runOneRound(plan, i, emit, signal);
    roundIds.push(id);
    emit({ stage: 'done', type: 'complete', round_id: id, ts: ts() });
  }
  log(emit, 'done', 'green', `✓ 전체 ${plan.rounds}라운드 완료`);
  return roundIds;
}
