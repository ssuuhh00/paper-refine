import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  ApplyOutcome,
  Decision,
  Project,
  RoundItem,
} from '@paper-refine/shared';
import { loadFullRound, patchDecisions } from '../parse/round.js';

async function readSection(latexRoot: string, sec: string): Promise<{ path: string; content: string }> {
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
    lines.push(`### ${item.key} (${item.section})`);
    lines.push(reason || '(사유 미작성)');
    lines.push('');
  }
  await fs.appendFile(notesPath, lines.join('\n'), 'utf8');
}

export async function applyRound(
  project: Project,
  roundId: string,
  opts: { dryRun: boolean },
): Promise<ApplyOutcome> {
  const round = await loadFullRound(project, roundId);
  if (!round) throw new Error('round not found');

  const bySection = new Map<string, RoundItem[]>();
  const rejectedItems: { item: RoundItem; reason: string }[] = [];
  const skipped: ApplyOutcome['skipped'] = [];

  for (const item of round.items) {
    const d = round.decisions[item.key];
    if (!d || d.state === 'pending' || d.state === 'skip') continue;
    if (d.applied_at) {
      skipped.push({ key: item.key, reason: 'already applied' });
      continue;
    }
    if (d.state === 'apply') {
      if (!item.original || !item.modified) {
        skipped.push({ key: item.key, reason: 'no original/modified pair' });
        continue;
      }
      if (item.section === '?' || item.section === 'multi') {
        skipped.push({ key: item.key, reason: `section unknown (${item.section})` });
        continue;
      }
      const list = bySection.get(item.section) ?? [];
      list.push(item);
      bySection.set(item.section, list);
    } else if (d.state === 'reject') {
      rejectedItems.push({ item, reason: d.reason ?? '' });
    }
  }

  const applied: ApplyOutcome['applied'] = [];
  const errors: ApplyOutcome['errors'] = [];

  for (const [section, items] of bySection) {
    let file: { path: string; content: string };
    try {
      file = await readSection(project.latex_root, section);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      for (const it of items) errors.push({ key: it.key, section, error: msg });
      continue;
    }

    let content = file.content;
    const successesThisFile: ApplyOutcome['applied'] = [];
    for (const it of items) {
      if (!content.includes(it.original)) {
        errors.push({
          key: it.key,
          section,
          error: 'original snippet not found (이미 적용됐거나 .tex가 수정됨)',
        });
        continue;
      }
      content = content.replace(it.original, it.modified);
      successesThisFile.push({ key: it.key, section });
    }

    if (!opts.dryRun && successesThisFile.length > 0) {
      await fs.writeFile(file.path, content, 'utf8');
    }
    applied.push(...successesThisFile);
  }

  if (!opts.dryRun) {
    await appendErrorNotes(project.error_notes_path, roundId, rejectedItems);

    const now = new Date().toISOString();
    const patch: Record<string, Decision> = {};
    for (const a of applied) {
      const prev = round.decisions[a.key]!;
      patch[a.key] = { ...prev, applied_at: now };
    }
    for (const r of rejectedItems) {
      const prev = round.decisions[r.item.key]!;
      patch[r.item.key] = { ...prev, applied_at: now };
    }
    if (Object.keys(patch).length > 0) {
      await patchDecisions(project, roundId, patch);
    }
  }

  return {
    applied,
    rejected: rejectedItems.map((r) => ({
      key: r.item.key,
      section: r.item.section,
      reason: r.reason,
    })),
    errors,
    skipped,
  };
}
