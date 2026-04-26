import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Persona } from '@paper-refine/shared';

const here = path.dirname(fileURLToPath(import.meta.url));
// pipeline/prompts.ts → server/prompts/
const PROMPTS_DIR = path.resolve(here, '..', '..', 'prompts');

export async function loadReviewerPrompt(persona: Persona): Promise<string> {
  return fs.readFile(path.join(PROMPTS_DIR, `reviewer_${persona}.md`), 'utf8');
}

export async function loadGeneratorPrompt(): Promise<string> {
  return fs.readFile(path.join(PROMPTS_DIR, 'generator.md'), 'utf8');
}

export async function loadDiscriminatorPrompt(): Promise<string> {
  return fs.readFile(path.join(PROMPTS_DIR, 'discriminator.md'), 'utf8');
}

export function promptsDir(): string {
  return PROMPTS_DIR;
}
