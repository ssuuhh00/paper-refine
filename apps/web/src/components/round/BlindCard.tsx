import type { BlindKind, ItemContext, Side } from '@paper-refine/shared';
import { Card } from '../ui/Card';

type Props = {
  side: Side;
  text: string;
  kind: BlindKind;
  revealed: boolean;
  picked: boolean;
  context?: ItemContext;
};

/**
 * Renders a blind candidate (A or B) with the surrounding `.tex` context
 * dimmed above and below — so the reader judges the candidate inside the
 * paragraph it lives in, not as a stranded snippet.
 */
export function BlindCard({ side, text, kind, revealed, picked, context }: Props) {
  return (
    <Card
      style={{
        padding: 0,
        overflow: 'hidden',
        borderColor: picked && revealed ? 'var(--ok)' : 'var(--border)',
      }}
    >
      <div
        style={{
          padding: '8px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              background: picked && revealed ? 'var(--ok)' : 'var(--ink)',
              color: 'var(--bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--mono)',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {side}
          </span>
          {revealed && (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
              {kind}
            </span>
          )}
        </div>
        {picked && revealed && (
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.5,
              color: 'var(--ok)',
              padding: '2px 6px',
              background: 'var(--ok-bg)',
              borderRadius: 3,
            }}
          >
            DISC. PICK
          </span>
        )}
      </div>

      <div style={{ maxHeight: 360, overflowY: 'auto', position: 'relative' }}>
        {context?.before && (
          <ContextBlock text={context.before} position="before" />
        )}
        <pre
          style={{
            margin: 0,
            padding: '10px 14px',
            fontFamily: 'var(--mono)',
            fontSize: 11.5,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: 'var(--ink)',
            background: revealed && picked ? 'var(--ok-bg)' : 'var(--surface-2)',
            borderTop: context?.before ? '1px dashed var(--border)' : 'none',
            borderBottom: context?.after ? '1px dashed var(--border)' : 'none',
          }}
        >
          {text}
        </pre>
        {context?.after && <ContextBlock text={context.after} position="after" />}
      </div>
    </Card>
  );
}

function ContextBlock({ text, position }: { text: string; position: 'before' | 'after' }) {
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          [position === 'before' ? 'top' : 'bottom']: 0,
          left: 0,
          right: 0,
          padding: '4px 14px',
          fontFamily: 'var(--mono)',
          fontSize: 9.5,
          color: 'var(--ink-4)',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          pointerEvents: 'none',
        }}
      >
        {position === 'before' ? '↑ context' : 'context ↓'}
      </div>
      <pre
        style={{
          margin: 0,
          padding: position === 'before' ? '20px 14px 8px' : '8px 14px 20px',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: 'var(--ink-4)',
          background: 'transparent',
        }}
      >
        {text}
      </pre>
    </div>
  );
}
