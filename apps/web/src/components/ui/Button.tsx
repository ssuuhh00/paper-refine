import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

const palette: Record<Variant, CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: 'var(--accent-fg)',
    border: '1px solid var(--accent)',
  },
  secondary: {
    background: 'var(--surface)',
    color: 'var(--ink-2)',
    border: '1px solid var(--border)',
  },
  danger: {
    background: 'transparent',
    color: 'var(--warn)',
    border: '1px solid var(--warn)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--ink-2)',
    border: '1px solid transparent',
  },
};

const sizing: Record<Size, CSSProperties> = {
  sm: { padding: '5px 10px', fontSize: 11 },
  md: { padding: '8px 14px', fontSize: 12 },
};

export function Button({
  variant = 'secondary',
  size = 'md',
  style,
  disabled,
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: variant === 'primary' ? 'var(--sans)' : 'var(--mono)',
        fontWeight: variant === 'primary' ? 600 : 500,
        opacity: disabled ? 0.5 : 1,
        ...palette[variant],
        ...sizing[size],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
