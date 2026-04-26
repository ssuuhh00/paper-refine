import { useEffect, useState } from 'react';
import type { ApplyResponse, Decision, RoundItem } from '@paper-refine/shared';
import { Button } from '../ui/Button';
import { api } from '../../lib/api';

type Phase = 'preview' | 'running' | 'done';

type Props = {
  projectId: string;
  roundId: string;
  items: RoundItem[];
  decisions: Record<string, Decision>;
  onClose: () => void;
  onApplied: () => void;
};

export function ApplyModal({
  projectId,
  roundId,
  items,
  decisions,
  onClose,
  onApplied,
}: Props) {
  const [phase, setPhase] = useState<Phase>('preview');
  const [dryRun, setDryRun] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ApplyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending: RoundItem[] = [];
  const alreadyApplied: RoundItem[] = [];
  const rejects: RoundItem[] = [];
  for (const it of items) {
    const d = decisions[it.r];
    if (!d) continue;
    if (d.state === 'apply') {
      if (d.applied_at) alreadyApplied.push(it);
      else pending.push(it);
    } else if (d.state === 'reject' && !d.applied_at) {
      rejects.push(it);
    }
  }

  const totalEdits = pending.reduce((acc, it) => acc + it.edits.length, 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submitting, onClose]);

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    setPhase('running');
    try {
      const res = await api.applyRound(projectId, roundId, { dry_run: dryRun });
      setResult(res);
      setPhase('done');
      if (!dryRun) onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('preview');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={() => !submitting && onClose()}
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
          width: 'min(760px, 92vw)',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          border: '1px solid var(--border)',
        }}
      >
        <Header
          phase={phase}
          dryRun={dryRun}
          counts={{
            pending: pending.length,
            pendingEdits: totalEdits,
            already: alreadyApplied.length,
            rejects: rejects.length,
            applied: result?.applied.length ?? 0,
            errors: result?.errors.length ?? 0,
          }}
          onClose={onClose}
          submitting={submitting}
        />

        <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                padding: '10px 14px',
                marginBottom: 14,
                background: 'var(--warn-bg)',
                color: 'var(--warn)',
                fontFamily: 'var(--mono)',
                fontSize: 11.5,
                borderRadius: 5,
              }}
            >
              {error}
            </div>
          )}

          {phase !== 'done' && (
            <>
              <Group label={`적용 대상 (${pending.length}개 R · ${totalEdits}개 edit)`}>
                {pending.length === 0 ? <Empty /> : pending.map((it) => <Row key={it.r} item={it} kind="apply" />)}
              </Group>
              {alreadyApplied.length > 0 && (
                <Group label={`이미 적용됨 (${alreadyApplied.length})`}>
                  {alreadyApplied.map((it) => (
                    <Row key={it.r} item={it} kind="already" />
                  ))}
                </Group>
              )}
              {rejects.length > 0 && (
                <Group label={`오답노트로 (${rejects.length})`}>
                  {rejects.map((it) => (
                    <Row key={it.r} item={it} kind="reject" reason={decisions[it.r]?.reason} />
                  ))}
                </Group>
              )}
            </>
          )}

          {phase === 'done' && result && <ResultView result={result} />}
        </div>

        <Footer
          phase={phase}
          dryRun={dryRun}
          setDryRun={setDryRun}
          submitting={submitting}
          canSubmit={pending.length + rejects.length > 0}
          onClose={onClose}
          onSubmit={submit}
          result={result}
          onAfterApply={() => {
            setResult(null);
            setPhase('preview');
            setDryRun(true);
          }}
        />
      </div>
    </div>
  );
}

function Header({
  phase,
  dryRun,
  counts,
  onClose,
  submitting,
}: {
  phase: Phase;
  dryRun: boolean;
  counts: {
    pending: number;
    pendingEdits: number;
    already: number;
    rejects: number;
    applied: number;
    errors: number;
  };
  onClose: () => void;
  submitting: boolean;
}) {
  const subtitle =
    phase === 'done'
      ? `${counts.applied} R 적용 · ${counts.errors} 에러`
      : phase === 'running'
        ? '실행 중…'
        : `${counts.pending}개 R (${counts.pendingEdits} edits) 적용 대기 · ${counts.rejects}개 오답노트로${counts.already ? ` · ${counts.already}개 이미 적용` : ''}${dryRun ? ' · dry-run' : ''}`;
  return (
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
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.2 }}>
          {phase === 'done' ? 'Apply 결과' : 'Apply preview'}
        </div>
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
      </div>
      <button
        onClick={onClose}
        disabled={submitting}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--ink-3)',
          fontSize: 20,
          cursor: submitting ? 'not-allowed' : 'pointer',
          width: 28,
          height: 28,
        }}
      >
        ×
      </button>
    </div>
  );
}

function Footer({
  phase,
  dryRun,
  setDryRun,
  submitting,
  canSubmit,
  onClose,
  onSubmit,
  result,
  onAfterApply,
}: {
  phase: Phase;
  dryRun: boolean;
  setDryRun: (b: boolean) => void;
  submitting: boolean;
  canSubmit: boolean;
  onClose: () => void;
  onSubmit: () => void;
  result: ApplyResponse | null;
  onAfterApply: () => void;
}) {
  if (phase === 'done') {
    const wasDryRun = result?.dry_run === true;
    return (
      <div
        style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
        }}
      >
        {wasDryRun && (
          <Button variant="primary" onClick={onAfterApply}>
            실제 적용으로 진행
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          닫기
        </Button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          border: '1px solid var(--border)',
          borderRadius: 5,
          cursor: 'pointer',
          background: dryRun ? 'var(--surface-2)' : 'var(--surface)',
        }}
      >
        <span
          style={{
            width: 28,
            height: 16,
            borderRadius: 8,
            background: dryRun ? 'var(--accent)' : 'var(--border)',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: dryRun ? 14 : 2,
              width: 12,
              height: 12,
              borderRadius: 6,
              background: '#fff',
              transition: 'left 0.15s',
            }}
          />
        </span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink-2)' }}>
          dry-run
        </span>
        <input
          type="checkbox"
          checked={dryRun}
          onChange={() => setDryRun(!dryRun)}
          style={{ display: 'none' }}
        />
      </label>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', flex: 1 }}>
        {dryRun
          ? '미리보기 — .tex 파일을 변경하지 않습니다.'
          : '⚠ 실제로 .tex와 error_notes.md에 기록합니다.'}
      </span>
      <Button variant="ghost" onClick={onClose} disabled={submitting}>
        취소
      </Button>
      <Button
        variant="primary"
        onClick={onSubmit}
        disabled={!canSubmit || submitting}
      >
        {submitting ? '처리 중…' : dryRun ? 'Dry-run 실행' : '실제 적용'}
      </Button>
    </div>
  );
}

function ResultView({ result }: { result: ApplyResponse }) {
  return (
    <>
      {result.dry_run && (
        <div
          style={{
            padding: '8px 12px',
            marginBottom: 14,
            background: 'var(--accent-bg)',
            color: 'var(--accent)',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            borderRadius: 4,
            letterSpacing: 0.5,
          }}
        >
          DRY-RUN — 변경 사항이 디스크에 기록되지 않았습니다.
        </div>
      )}
      <Group label={`적용됨 (${result.applied.length})`}>
        {result.applied.length === 0 ? (
          <Empty />
        ) : (
          result.applied.map((a) => (
            <ResultRow
              key={a.r}
              keyName={a.r}
              section={a.sections.join(', ')}
              kind="ok"
              detail={`${a.editCount}개 edit`}
            />
          ))
        )}
      </Group>
      {result.errors.length > 0 && (
        <Group label={`에러 (${result.errors.length})`}>
          {result.errors.map((e, i) => (
            <ResultRow
              key={`${e.r}-${i}`}
              keyName={e.r}
              section={e.section}
              kind="error"
              detail={e.error}
            />
          ))}
        </Group>
      )}
      {result.rejected.length > 0 && (
        <Group label={`오답노트 추가 (${result.rejected.length})`}>
          {result.rejected.map((r) => (
            <ResultRow key={r.r} keyName={r.r} section="" kind="reject" detail={r.reason} />
          ))}
        </Group>
      )}
      {result.skipped.length > 0 && (
        <Group label={`스킵 (${result.skipped.length})`}>
          {result.skipped.map((s) => (
            <ResultRow key={s.r} keyName={s.r} section="" kind="skip" detail={s.reason} />
          ))}
        </Group>
      )}
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10.5,
          color: 'var(--ink-3)',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return <div style={{ padding: 14, color: 'var(--ink-3)', fontSize: 12 }}>없음</div>;
}

function Row({
  item,
  kind,
  reason,
}: {
  item: RoundItem;
  kind: 'apply' | 'reject' | 'already';
  reason?: string;
}) {
  const color =
    kind === 'apply' ? 'var(--ok)' : kind === 'reject' ? 'var(--warn)' : 'var(--ink-4)';
  const sectionList = [...new Set(item.edits.map((e) => e.file))].join(', ');
  return (
    <div
      style={{
        marginBottom: 8,
        padding: '10px 12px',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 4,
        background: 'var(--surface)',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>
          {item.r}
        </span>
        <span style={{ fontSize: 12, color: 'var(--ink)' }}>{item.title || item.rule || '(제목 없음)'}</span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
          {item.edits.length} edits · {sectionList || '?'}
        </span>
      </div>
      {kind === 'apply' && item.edits[0] && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
          <span style={{ color: 'var(--del)' }}>
            − {item.edits[0].original.split('\n')[0]?.slice(0, 70)}…
          </span>
          <br />
          <span style={{ color: 'var(--add)' }}>
            + {item.edits[0].modified.split('\n')[0]?.slice(0, 70)}…
          </span>
          {item.edits.length > 1 && (
            <div style={{ marginTop: 2, color: 'var(--ink-4)' }}>
              + {item.edits.length - 1}개 추가 edit
            </div>
          )}
        </div>
      )}
      {kind === 'reject' && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
          {reason?.trim() || <em style={{ color: 'var(--ink-4)' }}>(사유 미작성)</em>}
        </div>
      )}
      {kind === 'already' && (
        <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
          이미 .tex에 반영됨 — 다시 적용되지 않습니다.
        </div>
      )}
    </div>
  );
}

function ResultRow({
  keyName,
  section,
  kind,
  detail,
}: {
  keyName: string;
  section: string;
  kind: 'ok' | 'error' | 'reject' | 'skip';
  detail?: string;
}) {
  const color =
    kind === 'ok'
      ? 'var(--ok)'
      : kind === 'error'
        ? 'var(--warn)'
        : kind === 'reject'
          ? 'var(--accent)'
          : 'var(--ink-4)';
  return (
    <div
      style={{
        marginBottom: 6,
        padding: '8px 12px',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 4,
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)' }}>
          {keyName}
        </span>
        {section && (
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
            {section}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 10, color }}>
          {kind}
        </span>
      </div>
      {detail && (
        <div
          style={{
            marginTop: 4,
            fontSize: 11.5,
            color: 'var(--ink-2)',
            lineHeight: 1.5,
          }}
        >
          {detail}
        </div>
      )}
    </div>
  );
}
