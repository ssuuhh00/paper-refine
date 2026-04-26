import React from 'react';

export type StepKey = 'review' | 'changes' | 'verdict';

export const STEPS: { k: StepKey; label: string; ko: string }[] = [
  { k: 'review', label: 'Review', ko: '리뷰' },
  { k: 'changes', label: 'Changes', ko: '수정안' },
  { k: 'verdict', label: 'Verdict', ko: '판정' },
];

type Props = {
  active: StepKey;
  onPick?: (k: StepKey) => void;
  compact?: boolean;
};

export function Stepper({ active, onPick, compact = false }: Props) {
  const idx = STEPS.findIndex((s) => s.k === active);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {STEPS.map((s, i) => {
        const isActive = i === idx;
        const isPast = i < idx;
        return (
          <React.Fragment key={s.k}>
            <button
              onClick={() => onPick?.(s.k)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: compact ? '4px 10px' : '6px 12px',
                border: 'none',
                background: isActive ? 'var(--ink)' : 'transparent',
                color: isActive ? 'var(--bg)' : isPast ? 'var(--ink)' : 'var(--ink-3)',
                borderRadius: 6,
                fontSize: 12,
                fontFamily: 'var(--mono)',
                cursor: 'pointer',
                fontWeight: isActive ? 600 : 500,
                letterSpacing: 0.2,
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  background: isActive ? 'var(--bg)' : isPast ? 'var(--ink)' : 'var(--surface-2)',
                  color: isActive ? 'var(--ink)' : isPast ? 'var(--bg)' : 'var(--ink-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 9.5,
                  fontWeight: 700,
                }}
              >
                {isPast ? '✓' : i + 1}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <div style={{ width: 14, height: 1, background: 'var(--border)' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
