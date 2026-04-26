/**
 * Generic helper that splits a markdown document into per-R "## R\d+(-N)? ..." blocks
 * and tracks an occurrence index for each R number — handles both formats observed
 * in the wild:
 *   - explicit suffix (R3-1, R3-2, R3-3) — common in verdict.md
 *   - bare repeats (## R3 ... ## R3 ...) — common in review.md / changes.md
 *   - mixed (## R3 then ## R3-2) — common in changes.md
 *
 * The returned occurrence is 1-based and consistent across files when paired by
 * insertion order within the same rid.
 */

const HEADER_RE = /^## (R\d+)(?:-(\d+))?([^\n]*)\n([\s\S]*?)(?=\n## R\d+|\n## 요약|\n---|(?![\s\S]))/gm;

export type ParsedBlock = {
  rid: string;
  occurrence: number;
  /** True if the source file used an explicit `-N` suffix in the header. */
  declared: boolean;
  /** The text on the header line after `## R{n}(-N)?` (excluding the trailing newline). */
  headerTail: string;
  body: string;
};

export function parseRBlocks(text: string | null): ParsedBlock[] {
  if (!text) return [];
  const out: ParsedBlock[] = [];
  const counters: Record<string, number> = {};
  let m: RegExpExecArray | null;
  HEADER_RE.lastIndex = 0;
  while ((m = HEADER_RE.exec(text)) !== null) {
    const rid = m[1]!;
    const declaredRaw = m[2];
    const headerTail = m[3] ?? '';
    const body = m[4] ?? '';
    let occurrence: number;
    if (declaredRaw !== undefined) {
      occurrence = Number(declaredRaw);
      counters[rid] = Math.max(counters[rid] ?? 0, occurrence);
    } else {
      counters[rid] = (counters[rid] ?? 0) + 1;
      occurrence = counters[rid]!;
    }
    out.push({ rid, occurrence, declared: declaredRaw !== undefined, headerTail, body });
  }
  return out;
}

/** Extracts the first `NN_name.tex` reference from a string, or null. */
export function extractSectionFile(...sources: (string | null | undefined)[]): string | null {
  for (const s of sources) {
    if (!s) continue;
    const m = s.match(/(\d{2}_\w+\.tex)/);
    if (m) return m[1]!;
  }
  return null;
}

export function itemKey(rid: string, occurrence: number): string {
  return `${rid}#${occurrence}`;
}
