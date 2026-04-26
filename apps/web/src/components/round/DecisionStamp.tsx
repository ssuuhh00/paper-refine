import type { DecisionState } from '@paper-refine/shared';

type Props = {
  state: DecisionState;
  size?: 'sm' | 'md';
};

const map: Record<DecisionState, { label: string; color: string; bg: string }> = {
  apply: { label: 'APPLY', color: 'var(--ok)', bg: 'var(--ok-bg)' },
  skip: { label: 'SKIP', color: 'var(--mute)', bg: 'var(--mute-bg)' },
  reject: { label: 'REJECT', color: 'var(--warn)', bg: 'var(--warn-bg)' },
  pending: { label: 'PENDING', color: 'var(--ink-3)', bg: 'transparent' },
};

export function DecisionStamp({ state, size = 'md' }: Props) {
  const s = map[state];
  const isPending = state === 'pending';
  const isSm = size === 'sm';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: isSm ? '1px 6px' : '2px 8px',
        borderRadius: 3,
        background: s.bg,
        color: s.color,
        fontSize: isSm ? 9.5 : 10.5,
        fontWeight: 600,
        letterSpacing: 0.6,
        fontFamily: 'var(--mono)',
        border: isPending ? '1px dashed var(--border)' : '1px solid transparent',
      }}
    >
      {s.label}
    </span>
  );
}
