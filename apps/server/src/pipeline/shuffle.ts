import type { BlindKind, Side } from '@paper-refine/shared';
import { parseRBlocks } from '../parse/sections.js';

const CODE_LATEX_RE = /```latex\n([\s\S]*?)```/g;

type ChangesItem = {
  rid: string;
  occurrence: number;
  ridDisplay: string;
  headerTail: string;
  original: string;
  modified: string;
};

export function parseChangesItems(changesText: string): ChangesItem[] {
  const blocks = parseRBlocks(changesText);
  const out: ChangesItem[] = [];
  for (const b of blocks) {
    CODE_LATEX_RE.lastIndex = 0;
    const codes: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = CODE_LATEX_RE.exec(b.body)) !== null) codes.push(m[1]!.trim());
    if (codes.length < 2) continue;
    const ridDisplay =
      b.declared || b.occurrence > 1 ? `${b.rid}-${b.occurrence}` : b.rid;
    out.push({
      rid: b.rid,
      occurrence: b.occurrence,
      ridDisplay,
      headerTail: b.headerTail,
      original: codes[0]!,
      modified: codes[1]!,
    });
  }
  return out;
}

export type ShuffleResult = {
  blindMd: string;
  mappingTxt: string;
  picks: { rid: string; occurrence: number; mapping: Record<Side, BlindKind> }[];
};

/**
 * Builds the blind A/B test markdown and the mapping that will be hidden from
 * the discriminator. Mirrors the Python heredoc in the original refine.sh.
 */
export function buildBlindTest(
  items: ChangesItem[],
  rng: () => number = Math.random,
): ShuffleResult {
  const blindLines = ['# Blind Test\n'];
  const mappingLines: string[] = [];
  const picks: ShuffleResult['picks'] = [];

  for (const item of items) {
    let aKind: BlindKind;
    let bKind: BlindKind;
    let versionA: string;
    let versionB: string;
    if (rng() < 0.5) {
      aKind = 'original';
      bKind = 'modified';
      versionA = item.original;
      versionB = item.modified;
    } else {
      aKind = 'modified';
      bKind = 'original';
      versionA = item.modified;
      versionB = item.original;
    }
    const ridLabel =
      item.occurrence > 1 ? `${item.rid}-${item.occurrence}` : item.rid;
    mappingLines.push(`${ridLabel}:A=${aKind},B=${bKind}`);
    picks.push({
      rid: item.rid,
      occurrence: item.occurrence,
      mapping: { A: aKind, B: bKind },
    });
    blindLines.push(`\n## ${ridLabel}${item.headerTail}\n`);
    blindLines.push(`\n### 버전 A\n\`\`\`latex\n${versionA}\n\`\`\`\n`);
    blindLines.push(`\n### 버전 B\n\`\`\`latex\n${versionB}\n\`\`\`\n`);
  }

  return {
    blindMd: blindLines.join('\n'),
    mappingTxt: mappingLines.join('\n') + '\n',
    picks,
  };
}
