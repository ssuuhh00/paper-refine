import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  style?: CSSProperties;
};

export function Card({ children, style, ...rest }: Props) {
  return (
    <div
      {...rest}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
