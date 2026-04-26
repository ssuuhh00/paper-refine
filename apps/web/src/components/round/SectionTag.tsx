type Props = {
  id: string;
  full?: boolean;
};

/**
 * Renders a section file as a small chip — strips ".tex" and the leading
 * "NN_" prefix for short form. Falls back to the raw id if it doesn't match
 * the expected pattern.
 */
export function SectionTag({ id, full = false }: Props) {
  const label = (() => {
    if (full) return id;
    if (id === 'multi') return 'multi';
    if (id === '?') return '?';
    const m = id.match(/^(\d{2})_(.+)\.tex$/);
    if (!m) return id;
    return `${m[1]} ${m[2]}`;
  })();
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 7px',
        borderRadius: 4,
        background: 'var(--surface-2)',
        color: 'var(--ink-2)',
        fontSize: 10.5,
        fontFamily: 'var(--mono)',
        whiteSpace: 'nowrap',
      }}
    >
      §{label}
    </span>
  );
}
