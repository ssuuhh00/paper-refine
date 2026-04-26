import type { ReactNode } from 'react';

type Props = {
  label?: string;
  desc?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
};

export function Field({ label, desc, hint, children }: Props) {
  return (
    <div style={{ marginBottom: 18 }}>
      {label && (
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            color: 'var(--ink-3)',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          {label}
        </div>
      )}
      {desc && (
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--ink-3)',
            marginBottom: 8,
            lineHeight: 1.5,
          }}
        >
          {desc}
        </div>
      )}
      {children}
      {hint && (
        <div
          style={{
            marginTop: 6,
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--ink-3)',
            lineHeight: 1.5,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}
