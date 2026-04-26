import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  ApplyOutcome,
  Decision,
  Project,
  RoundItem,
} from '@paper-refine/shared';
import { loadFullRound, patchDecisions } from '../parse/round.js';

async function readSection(
  latexRoot: string,
  sec: string,
): Promise<{ path: string; content: string }> {
  const candidates = [path.join(latexRoot, 'sections', sec), path.join(latexRoot, sec)];
  let lastErr: unknown;
  for (const p of candidates) {
    try {
      const content = await fs.readFile(p, 'utf8');
      return { path: p, content };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error(`section not found: ${sec}`);
}

async function appendErrorNotes(
  notesPath: string,
  roundId: string,
  rejected: { item: RoundItem; reason: string }[],
): Promise<void> {
  if (rejected.length === 0) return;
  await fs.mkdir(path.dirname(notesPath), { recursive: true });
  let header = '';
  try {
    await fs.access(notesPath);
  } catch {
    header =
      '# 오답노트 (Error Notes)\n\nGenerator가 참고할 수 있는 이전 라운드의 거부 피드백 모음.\n\n---\n\n';
  }
  const lines: string[] = [];
  if (header) lines.push(header);
  lines.push(`\n## ${roundId}\n`);
  for (const { item, reason } of rejected) {
    lines.push(`### ${item.r}: ${item.title || item.rule || '(제목 없음)'}`);
    if (item.rule) lines.push(`- **Rule**: ${item.rule}`);
    lines.push(`- **거부 사유**: ${reason || '(사유 미작성)'}`);
    if (item.edits.length > 0) {
      lines.push(`- **거부된 edits**: ${item.edits.length}개 (${[...new Set(item.edits.map((e) => e.file))].join(', ')})`);
    }
    lines.push('');
  }
  await fs.appendFile(notesPath, lines.join('\n'), 'utf8');
}

/**
 * Apply a round's user-approved R items to the .tex tree.
 *
 * For each `apply` R: iterate its edits, string-replace each one. If a
 * specific edit's `original` substring is missing (e.g. .tex was hand-edited
 * since generation), that edit is recorded as an error and skipped — the
 * other edits in the same R still apply. The whole R is considered
 * "applied" if at least one of its edits succeeded.
 *
 * For each `reject` R: append a single block to the project's error_notes.md
 * (one entry per R, not per edit).
 */
export async function applyRound(
  project: Project,
  roundId: string,
  opts: { dryRun: boolean },
): Promise<ApplyOutcome> {
  const round = await loadFullRound(project, roundId);
  if (!round) throw new Error('round not found');

  const applied: ApplyOutcome['applied'] = [];
  const errors: ApplyOutcome['errors'] = [];
  const skipped: ApplyOutcome['skipped'] = [];
  const rejectedItems: { item: RoundItem; reason: string }[] = [];

  // Group apply targets by section so we read each .tex once and write it
  // once at the end (so multiple edits in the same file are sequenced).
  type SectionPlan = {
    file: { path: string; content: string };
    edits: { r: string; original: string; modified: string }[];
  };
  const plans = new Map<string, SectionPlan>();

  // Track which R's actually have at least one valid edit lined up.
  const rEditCount = new Map<string, { sections: Set<string>; ok: number; fail: number }>();
  const rError = (r: string) => {
    const e = rEditCount.get(r) ?? { sections: new Set<string>(), ok: 0, fail: 0 };
    rEditCount.set(r, e);
    return e;
  };

  for (const item of round.items) {
    const d = round.decisions[item.r];
    if (!d || d.state === 'pending' || d.state === 'skip') continue;
    if (d.applied_at) {
      skipped.push({ r: item.r, reason: 'already applied' });
      continue;
    }
    if (d.state === 'reject') {
      rejectedItems.push({ item, reason: d.reason ?? '' });
      continue;
    }
    if (d.state !== 'apply') continue;
    if (item.edits.length === 0) {
      skipped.push({ r: item.r, reason: 'no edits in this R' });
      continue;
    }

    for (const edit of item.edits) {
      if (!edit.file || !edit.original || !edit.modified) {
        errors.push({ r: item.r, section: edit.file || '?', error: 'incomplete edit (missing file/original/modified)' });
        rError(item.r).fail++;
        continue;
      }
      let plan = plans.get(edit.file);
      if (!plan) {
        try {
          plan = { file: await readSection(project.latex_root, edit.file), edits: [] };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ r: item.r, section: edit.file, error: msg });
          rError(item.r).fail++;
          continue;
        }
        plans.set(edit.file, plan);
      }
      plan.edits.push({ r: item.r, original: edit.original, modified: edit.modified });
    }
  }

  // Execute edits: for each section, walk its planned edits in order.
  for (const [section, plan] of plans) {
    let content = plan.file.content;
    for (const e of plan.edits) {
      if (!content.includes(e.original)) {
        errors.push({
          r: e.r,
          section,
          error: 'original snippet not found (이미 적용됐거나 .tex가 수정됨)',
        });
        rError(e.r).fail++;
        continue;
      }
      content = content.replace(e.original, e.modified);
      const acc = rError(e.r);
      acc.sections.add(section);
      acc.ok++;
    }

    if (!opts.dryRun && content !== plan.file.content) {
      await fs.writeFile(plan.file.path, content, 'utf8');
    }
  }

  // Roll up per-R outcomes.
  for (const item of round.items) {
    const d = round.decisions[item.r];
    if (!d || d.state !== 'apply' || d.applied_at || item.edits.length === 0) continue;
    const acc = rEditCount.get(item.r);
    if (!acc) continue;
    if (acc.ok > 0) {
      applied.push({ r: item.r, editCount: acc.ok, sections: [...acc.sections] });
    } else {
      // every edit failed — surface it as a skip so the user knows to retry
      skipped.push({ r: item.r, reason: `all ${acc.fail} edits failed (see errors)` });
    }
  }

  if (!opts.dryRun) {
    await appendErrorNotes(project.error_notes_path, roundId, rejectedItems);

    const now = new Date().toISOString();
    const patch: Record<string, Decision> = {};
    for (const a of applied) {
      const prev = round.decisions[a.r]!;
      patch[a.r] = { ...prev, applied_at: now };
    }
    for (const r of rejectedItems) {
      const prev = round.decisions[r.item.r]!;
      patch[r.item.r] = { ...prev, applied_at: now };
    }
    if (Object.keys(patch).length > 0) {
      await patchDecisions(project, roundId, patch);
    }
  }

  return {
    applied,
    rejected: rejectedItems.map((r) => ({ r: r.item.r, reason: r.reason })),
    errors,
    skipped,
  };
}
