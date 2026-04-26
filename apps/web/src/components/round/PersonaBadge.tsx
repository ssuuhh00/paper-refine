import type { Persona } from '@paper-refine/shared';
import { PERSONAS } from '../../data/personas';

type Props = {
  id: Persona | null;
  size?: 'sm' | 'md';
};

export function PersonaBadge({ id, size = 'md' }: Props) {
  const isSm = size === 'sm';
  if (!id) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          padding: isSm ? '2px 7px' : '3px 9px',
          borderRadius: 999,
          background: 'var(--surface-2)',
          color: 'var(--ink-3)',
          fontSize: isSm ? 10 : 11,
          fontFamily: 'var(--mono)',
          letterSpacing: 0.2,
        }}
      >
        ? persona
      </span>
    );
  }
  const p = PERSONAS[id];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: isSm ? '2px 7px' : '3px 9px',
        borderRadius: 999,
        background: `oklch(0.96 0.02 ${p.hue})`,
        color: `oklch(0.42 0.12 ${p.hue})`,
        fontSize: isSm ? 10 : 11,
        fontWeight: 500,
        letterSpacing: 0.2,
        fontFamily: 'var(--mono)',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: 5,
          background: `oklch(0.55 0.15 ${p.hue})`,
        }}
      />
      {p.short}
    </span>
  );
}
