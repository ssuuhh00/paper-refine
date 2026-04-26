import type { InputHTMLAttributes } from 'react';
import { forwardRef } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  mono?: boolean;
};

export const TextInput = forwardRef<HTMLInputElement, Props>(function TextInput(
  { mono = true, style, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      {...rest}
      style={{
        width: '100%',
        padding: '8px 11px',
        border: '1px solid var(--border)',
        background: 'var(--bg)',
        color: 'var(--ink)',
        borderRadius: 5,
        fontSize: 12.5,
        fontFamily: mono ? 'var(--mono)' : 'var(--sans)',
        outline: 'none',
        boxSizing: 'border-box',
        ...style,
      }}
    />
  );
});
