import type { ItemContext } from '@paper-refine/shared';

const SPAN = 320;

function capture(text: string, idx: number, len: number): ItemContext {
  const start = Math.max(0, idx - SPAN);
  const end = Math.min(text.length, idx + len + SPAN);

  let before = text.slice(start, idx);
  let after = text.slice(idx + len, end);

  // snap to line boundaries when we trimmed mid-line
  if (start > 0) {
    const nl = before.indexOf('\n');
    if (nl !== -1 && nl < before.length - 1) before = before.slice(nl + 1);
  }
  if (end < text.length) {
    const nl = after.lastIndexOf('\n');
    if (nl > 0) after = after.slice(0, nl);
  }

  return { before, after, span: SPAN };
}

/**
 * Locate `original` (or, as a fallback for already-applied legacy rounds,
 * `modified`) inside `sectionText` and return surrounding text. Returns null
 * only when neither snippet can be located.
 */
export function extractContext(
  sectionText: string,
  original: string,
  modified?: string,
): ItemContext | null {
  if (original) {
    const idx = sectionText.indexOf(original);
    if (idx !== -1) return capture(sectionText, idx, original.length);
  }
  if (modified) {
    const idx = sectionText.indexOf(modified);
    if (idx !== -1) return capture(sectionText, idx, modified.length);
  }
  return null;
}
