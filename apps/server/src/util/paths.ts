import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

export function resolveAbsolute(p: string): string {
  if (!p) return p;
  let resolved = p;
  if (resolved.startsWith('~/') || resolved === '~') {
    resolved = path.join(homedir(), resolved.slice(1));
  }
  return path.resolve(resolved);
}

function findRepoRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string };
        if (pkg.name === 'paper-refine') return dir;
      } catch {
        // keep climbing
      }
    }
    dir = path.dirname(dir);
  }
  throw new Error('paper-refine repo root not found from paths.ts location');
}

export const REPO_ROOT = findRepoRoot();
export const DATA_ROOT = path.join(REPO_ROOT, 'data');

export function defaultOutputDir(project_id: string): string {
  return path.join(DATA_ROOT, 'projects', project_id);
}

export function defaultErrorNotes(project_id: string): string {
  return path.join(defaultOutputDir(project_id), 'error_notes.md');
}

const LEGACY_OUTPUT_SUFFIX = `${path.sep}refine_output`;

export function isLegacyOutputDir(p: string | undefined): boolean {
  if (!p) return true;
  return p.endsWith(LEGACY_OUTPUT_SUFFIX);
}
