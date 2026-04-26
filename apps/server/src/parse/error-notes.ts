import type { ErrorNote, Project } from '@paper-refine/shared';
import { listRoundsInDir, loadFullRound } from './round.js';

function dayPart(iso: string): string {
  const i = iso.indexOf('T');
  return i === -1 ? iso : iso.slice(0, i);
}

/** Pick a single section label for an R: the unique edit file or 'multi'. */
function rSection(item: { edits?: { file: string }[] }): string {
  const set = new Set<string>();
  for (const e of item.edits ?? []) set.add(e.file);
  if (set.size === 0) return '?';
  if (set.size === 1) return [...set][0]!;
  return 'multi';
}

/**
 * Aggregate rejection signals across all rounds:
 *   - user rejects: decisions.json with state === 'reject'
 *   - discriminator rejects: verdict picked the side mapped to `original`
 */
export async function aggregateErrorNotes(project: Project): Promise<ErrorNote[]> {
  const summaries = await listRoundsInDir(project.output_dir, project.id);
  const out: ErrorNote[] = [];

  for (const s of summaries) {
    const round = await loadFullRound(project, s.id);
    if (!round) continue;

    for (const item of round.items) {
      const persona = round.persona;
      const section = rSection(item);

      const d = round.decisions[item.r];
      if (d?.state === 'reject') {
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
      if (pickKind === 'original' && (item.verdict.loserReason || item.verdict.reason)) {
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
