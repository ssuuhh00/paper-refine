import type { ErrorNote, Project } from '@paper-refine/shared';
import { listRoundsInDir, loadFullRound } from './round.js';

function ridDisplay(r: string, occurrence: number): string {
  return occurrence > 1 ? `${r}-${occurrence}` : r;
}

function dayPart(iso: string): string {
  const i = iso.indexOf('T');
  return i === -1 ? iso : iso.slice(0, i);
}

/**
 * Aggregates rejection signals across all rounds of a project:
 *   - user rejects: decisions.json entries where state === 'reject'
 *   - discriminator rejects: verdict picks that landed on `original`
 *     (i.e. the modified suggestion lost the blind test) — uses loserReason
 *
 * Newest first. Older empty-reason entries still surface so the user can
 * spot patterns even when the reason text wasn't captured.
 */
export async function aggregateErrorNotes(project: Project): Promise<ErrorNote[]> {
  const summaries = await listRoundsInDir(project.output_dir, project.id);
  const out: ErrorNote[] = [];

  for (const s of summaries) {
    const round = await loadFullRound(project, s.id);
    if (!round) continue;

    for (const item of round.items) {
      const display = ridDisplay(item.r, item.occurrence);
      const persona = round.persona;

      // user reject
      const d = round.decisions[item.key];
      if (d?.state === 'reject') {
        out.push({
          round: s.id,
          key: item.key,
          r: display,
          section: item.section,
          persona,
          source: 'user',
          date: dayPart(d.decided_at ?? round.ts),
          reason: d.reason ?? '',
          title: item.title,
        });
      }

      // discriminator reject (kept original = rejected modified)
      const pickKind = item.blind[item.verdict.pick];
      if (pickKind === 'original' && (item.verdict.loserReason || item.verdict.reason)) {
        out.push({
          round: s.id,
          key: item.key,
          r: display,
          section: item.section,
          persona,
          source: 'discriminator',
          date: dayPart(round.ts),
          reason: item.verdict.loserReason || item.verdict.reason,
          title: item.title,
        });
      }
    }
  }

  // newest first by round id (which encodes timestamp), then user-before-discriminator
  out.sort((a, b) => {
    if (a.round !== b.round) return a.round < b.round ? 1 : -1;
    if (a.source !== b.source) return a.source === 'user' ? -1 : 1;
    return a.key < b.key ? -1 : 1;
  });
  return out;
}
