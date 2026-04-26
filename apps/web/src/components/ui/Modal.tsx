import type { ReactNode } from 'react';
import { useEffect } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number | string;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({ open, onClose, title, subtitle, width = 560, children, footer }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          borderRadius: 10,
          width: typeof width === 'number' ? `min(${width}px, 92vw)` : width,
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.2 }}>{title}</div>
            {subtitle && (
              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  color: 'var(--ink-3)',
                  marginTop: 2,
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--ink-3)',
              fontSize: 20,
              cursor: 'pointer',
              width: 28,
              height: 28,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>{children}</div>
        {footer && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
