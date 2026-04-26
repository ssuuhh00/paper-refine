import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 5px',
        borderRadius: 3,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderBottomWidth: 2,
        color: 'var(--ink-2)',
        fontSize: 10,
        fontFamily: 'var(--mono)',
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}
