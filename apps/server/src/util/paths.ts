import path from 'node:path';
import { homedir } from 'node:os';

export function resolveAbsolute(p: string): string {
  if (!p) return p;
  let resolved = p;
  if (resolved.startsWith('~/') || resolved === '~') {
    resolved = path.join(homedir(), resolved.slice(1));
  }
  return path.resolve(resolved);
}

export function defaultOutputDir(latex_root: string): string {
  return path.join(latex_root, 'refine_output');
}

export function defaultErrorNotes(output_dir: string): string {
  return path.join(output_dir, 'error_notes.md');
}
