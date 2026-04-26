import type { DecisionState } from '@paper-refine/shared';

type Props = {
  counts: Partial<Record<DecisionState, number>>;
  size?: number;
};

const ORDER: { k: DecisionState; c: string }[] = [
  { k: 'apply', c: 'var(--ok)' },
  { k: 'skip', c: 'var(--mute)' },
  { k: 'reject', c: 'var(--warn)' },
  { k: 'pending', c: 'var(--ink-4)' },
];

export function DecisionDonut({ counts, size = 36 }: Props) {
  const total = Object.values(counts).reduce<number>((a, b) => a + (b ?? 0), 0) || 1;
  const r = size / 2 - 3;
  const cx = size / 2;
  const cy = size / 2;
  const C = 2 * Math.PI * r;
  let off = 0;
  const applyPct = Math.round(((counts.apply ?? 0) / total) * 100);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={3} />
        {ORDER.map((o) => {
          const v = counts[o.k] ?? 0;
          if (!v) return null;
          const len = (v / total) * C;
          const el = (
            <circle
              key={o.k}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={o.c}
              strokeWidth={3}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-off}
            />
          );
          off += len;
          return el;
        })}
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size > 50 ? 11 : 9,
          fontFamily: 'var(--mono)',
          color: 'var(--ink-2)',
          fontWeight: 600,
        }}
      >
        {applyPct}%
      </div>
    </div>
  );
}
