import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Project } from '@paper-refine/shared';

/**
 * Composite identity for an error-note row in the timeline. Two notes can
 * share the same (round, key) when both `user` and `discriminator` triggered
 * a rejection at the same R, so `source` is part of the key.
 */
export type DismissedKey = {
  round: string;
  key: string;
  source: 'user' | 'discriminator';
};

function dismissedPath(project: Project): string {
  return path.join(project.output_dir, 'dismissed_error_notes.json');
}

function dedupKey(d: DismissedKey): string {
  return `${d.round}::${d.key}::${d.source}`;
}

function isValid(x: unknown): x is DismissedKey {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.round === 'string' &&
    typeof o.key === 'string' &&
    (o.source === 'user' || o.source === 'discriminator')
  );
}

export async function readDismissed(project: Project): Promise<DismissedKey[]> {
  try {
    const text = await fs.readFile(dismissedPath(project), 'utf8');
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValid);
  } catch {
    return [];
  }
}

export async function writeDismissed(project: Project, list: DismissedKey[]): Promise<void> {
  await fs.mkdir(path.dirname(dismissedPath(project)), { recursive: true });
  await fs.writeFile(dismissedPath(project), JSON.stringify(list, null, 2), 'utf8');
}

export async function addDismissed(
  project: Project,
  items: DismissedKey[],
): Promise<DismissedKey[]> {
  const current = await readDismissed(project);
  const seen = new Set(current.map(dedupKey));
  for (const it of items) {
    if (!isValid(it)) continue;
    const k = dedupKey(it);
    if (!seen.has(k)) {
      current.push({ round: it.round, key: it.key, source: it.source });
      seen.add(k);
    }
  }
  await writeDismissed(project, current);
  return current;
}

export function dismissedSet(list: DismissedKey[]): Set<string> {
  return new Set(list.map(dedupKey));
}
