import { useEffect, useState } from 'react';
import type { Decision, DecisionState, RoundItem } from '@paper-refine/shared';
import { Kbd } from '../ui/Kbd';

type Props = {
  item: RoundItem;
  decision: Decision;
  showKbdHints: boolean;
  onDecide: (state: DecisionState, extra?: { reason?: string; memo?: string }) => void;
  onPrev: () => void;
  onNext: () => void;
};

const navBtnStyle = {
  display: 'inline-flex' as const,
  alignItems: 'center' as const,
  gap: 6,
  padding: '5px 10px',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--ink-2)',
  borderRadius: 5,
  fontSize: 11,
  fontFamily: 'var(--mono)',
  cursor: 'pointer',
};

const inputStyle = {
  width: '100%',
  marginTop: 6,
  padding: '7px 10px',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--ink)',
  borderRadius: 5,
  fontSize: 12,
  fontFamily: 'var(--sans)',
  outline: 'none',
  boxSizing: 'border-box' as const,
};

export function DecisionBar({
  item,
  decision,
  showKbdHints,
  onDecide,
  onPrev,
  onNext,
}: Props) {
  const [memo, setMemo] = useState(decision.memo ?? '');
  const [rejectReason, setRejectReason] = useState(decision.reason ?? '');

  useEffect(() => {
    setMemo(decision.memo ?? '');
    setRejectReason(decision.reason ?? '');
  }, [item.key, decision.state]);

  const opt = (
    state: DecisionState,
    label: string,
    ko: string,
    color: string,
    bg: string,
  ) => {
    const active = decision.state === state;
    return (
      <button
        onClick={() => onDecide(state, state === 'reject' ? { reason: rejectReason } : {})}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '10px 14px',
          border: active ? `2px solid ${color}` : '1px solid var(--border)',
          background: active ? bg : 'var(--surface)',
          color: active ? color : 'var(--ink-2)',
          borderRadius: 6,
          cursor: 'pointer',
          transition: 'all 0.12s',
          gap: 2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.4,
              color: active ? color : 'var(--ink)',
            }}
          >
            {label}
          </span>
          {showKbdHints && (
            <span style={{ marginLeft: 'auto' }}>
              <Kbd>{state[0]!.toUpperCase()}</Kbd>
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: active ? color : 'var(--ink-3)' }}>{ko}</span>
      </button>
    );
  };

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.04)',
        padding: '12px 24px',
        zIndex: 10,
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              color: 'var(--ink-3)',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            최종 결정 · {item.key}
          </span>
          <span style={{ flex: 1 }} />
          <button onClick={onPrev} style={navBtnStyle}>
            {showKbdHints && <Kbd>←</Kbd>} 이전
          </button>
          <button onClick={onNext} style={navBtnStyle}>
            다음 {showKbdHints && <Kbd>→</Kbd>}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {opt('apply', 'APPLY', '수정안 채택', 'var(--ok)', 'var(--ok-bg)')}
          {opt('skip', 'SKIP', '결정 보류', 'var(--mute)', 'var(--mute-bg)')}
          {opt('reject', 'REJECT', '원문 유지 + 사유', 'var(--warn)', 'var(--warn-bg)')}
        </div>
        {decision.state === 'reject' && (
          <input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            onBlur={() => onDecide('reject', { reason: rejectReason, memo })}
            placeholder="거부 사유 — 오답노트로 누적됩니다"
            style={inputStyle}
          />
        )}
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          onBlur={() => onDecide(decision.state, { memo, reason: rejectReason })}
          placeholder="메모 (선택)"
          style={inputStyle}
        />
      </div>
    </div>
  );
}
