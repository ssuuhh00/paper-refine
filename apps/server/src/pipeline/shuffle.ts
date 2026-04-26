import type {
  BlindFile,
  BlindKind,
  Edit,
  GeneratorOutput,
  Side,
} from '@paper-refine/shared';

export type ChangesItem = {
  r: string;
  rule: string;
  rationale: string;
  edits: Pick<Edit, 'file' | 'original' | 'modified'>[];
};

export type ShuffleResult = {
  blindMd: string;
  blindFile: BlindFile;
  picks: { r: string; mapping: Record<Side, BlindKind> }[];
};

/** Convert the generator JSON output to the internal ChangesItem list. */
export function fromGeneratorOutput(out: GeneratorOutput): ChangesItem[] {
  return out.items.map((it) => ({
    r: it.r,
    rule: it.rule,
    rationale: it.rationale,
    edits: it.edits,
  }));
}

/**
 * Render one candidate (original or modified) for a multi-edit R as a sequence
 * of file-tagged LaTeX snippets. The discriminator must see all of an R's
 * edits as a single package because a verdict applies to the whole R.
 */
function renderCandidate(
  edits: Pick<Edit, 'file' | 'original' | 'modified'>[],
  kind: BlindKind,
): string {
  if (edits.length === 0) return '_(빈 수정안)_';
  const parts: string[] = [];
  edits.forEach((e, i) => {
    const num = edits.length > 1 ? `**(${i + 1}/${edits.length})** ` : '';
    parts.push(`${num}\`${e.file}\`\n\n\`\`\`latex\n${kind === 'original' ? e.original : e.modified}\n\`\`\``);
  });
  return parts.join('\n\n');
}

/**
 * Builds the blind A/B test markdown and the per-R mapping kept hidden from
 * the discriminator. Each R becomes one block with two candidate clusters; the
 * mapping flips A↔B at random so the discriminator can't infer which side is
 * the original.
 */
export function buildBlindTest(
  items: ChangesItem[],
  rng: () => number = Math.random,
): ShuffleResult {
  const blindLines = ['# Blind Test\n'];
  const blindFile: BlindFile = { items: [] };
  const picks: ShuffleResult['picks'] = [];

  for (const item of items) {
    if (item.edits.length === 0) continue;

    let aKind: BlindKind;
    let bKind: BlindKind;
    if (rng() < 0.5) {
      aKind = 'original';
      bKind = 'modified';
    } else {
      aKind = 'modified';
      bKind = 'original';
    }

    const mapping = { A: aKind, B: bKind };
    blindFile.items.push({ r: item.r, mapping });
    picks.push({ r: item.r, mapping });

    blindLines.push(`\n## ${item.r} — ${item.rule}\n`);
    blindLines.push(`\n### 버전 A\n\n${renderCandidate(item.edits, aKind)}\n`);
    blindLines.push(`\n### 버전 B\n\n${renderCandidate(item.edits, bKind)}\n`);
  }

  return {
    blindMd: blindLines.join('\n'),
    blindFile,
    picks,
  };
}
