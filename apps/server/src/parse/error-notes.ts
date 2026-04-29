import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ErrorNote, Project } from '@paper-refine/shared';
import { listRoundsInDir, loadFullRound } from './round.js';
import { dismissedSet, readDismissed } from '../store/dismissed-notes.js';

function dayPart(iso: string): string {
  const i = iso.indexOf('T');
  return i === -1 ? iso : iso.slice(0, i);
}

function rSection(item: { edits?: { file: string }[] }): string {
  const set = new Set<string>();
  for (const e of item.edits ?? []) set.add(e.file);
  if (set.size === 0) return '?';
  if (set.size === 1) return [...set][0]!;
  return 'multi';
}

function noteKey(round: string, key: string, source: ErrorNote['source']): string {
  return `${round}::${key}::${source}`;
}

/**
 * Aggregate rejection signals across all rounds:
 *   - user rejects: decisions.json with state === 'reject'
 *   - discriminator rejects: verdict picked the side mapped to `original`
 * Dismissed entries (recorded in dismissed_error_notes.json) are filtered out.
 */
export async function aggregateErrorNotes(project: Project): Promise<ErrorNote[]> {
  const [summaries, dismissed] = await Promise.all([
    listRoundsInDir(project.output_dir, project.id),
    readDismissed(project),
  ]);
  const dismissedKeys = dismissedSet(dismissed);
  const out: ErrorNote[] = [];

  for (const s of summaries) {
    const round = await loadFullRound(project, s.id);
    if (!round) continue;

    for (const item of round.items) {
      const persona = round.persona;
      const section = rSection(item);

      const d = round.decisions[item.r];
      if (d?.state === 'reject' && !dismissedKeys.has(noteKey(s.id, item.r, 'user'))) {
        out.push({
          round: s.id,
          key: item.r,
          r: item.r,
          section,
          persona,
          source: 'user',
          date: dayPart(d.decided_at ?? round.ts),
          reason: d.reason ?? '',
          title: item.title || item.rule,
        });
      }

      const pickKind = item.blind[item.verdict.pick];
      if (
        pickKind === 'original' &&
        (item.verdict.loserReason || item.verdict.reason) &&
        !dismissedKeys.has(noteKey(s.id, item.r, 'discriminator'))
      ) {
        out.push({
          round: s.id,
          key: item.r,
          r: item.r,
          section,
          persona,
          source: 'discriminator',
          date: dayPart(round.ts),
          reason: item.verdict.loserReason || item.verdict.reason,
          title: item.title || item.rule,
        });
      }
    }
  }

  out.sort((a, b) => {
    if (a.round !== b.round) return a.round < b.round ? 1 : -1;
    if (a.source !== b.source) return a.source === 'user' ? -1 : 1;
    return a.key < b.key ? -1 : 1;
  });
  return out;
}

const ERROR_NOTES_HEADER =
  '# 오답노트 (Error Notes)\n\nGenerator가 참고할 수 있는 이전 라운드의 거부 피드백 모음.\n\n---\n';

/**
 * Rewrite project.error_notes_path from the (filtered) aggregator output.
 * Only `user` source notes are written — these represent explicit user
 * rejections the Generator should learn from; discriminator-side rejects are
 * shown in the timeline but not fed back into the prompt input.
 */
export async function rebuildErrorNotesMd(project: Project): Promise<void> {
  const notes = (await aggregateErrorNotes(project)).filter((n) => n.source === 'user');
  const lines: string[] = [ERROR_NOTES_HEADER];
  let lastRound = '';
  for (const n of notes) {
    if (n.round !== lastRound) {
      lines.push(`\n## ${n.round}\n`);
      lastRound = n.round;
    }
    const head = `### ${n.r}${n.section && n.section !== '?' ? ` (${n.section})` : ''}: ${n.title || '(제목 없음)'}`;
    lines.push(head);
    lines.push(n.reason?.trim() || '(사유 미작성)');
    lines.push('');
  }
  await fs.mkdir(path.dirname(project.error_notes_path), { recursive: true });
  await fs.writeFile(project.error_notes_path, lines.join('\n'), 'utf8');
}
