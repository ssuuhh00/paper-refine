import { Link } from 'react-router-dom';
import type { RoundSummary } from '@paper-refine/shared';
import { Card } from '../ui/Card';
import { PersonaBadge } from './PersonaBadge';
import { SectionTag } from './SectionTag';
import { DecisionDonut } from './DecisionDonut';

type Props = {
  round: RoundSummary;
};

export function RoundCard({ round }: Props) {
  const total = round.itemCount;
  const recModified = round.recommendedModified;
  const recOriginal = Math.max(0, total - recModified);

  const counts = {
    apply: round.applyCount,
    skip: round.skipCount,
    reject: round.rejectCount,
    pending: round.pendingCount,
  };

  return (
    <Card
      style={{
        padding: 14,
        cursor: 'pointer',
        transition: 'border 0.12s',
        position: 'relative',
      }}
    >
      <Link
        to={`/rounds/${round.id}`}
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
        aria-label={`open ${round.id}`}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 10,
          position: 'relative',
        }}
      >
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
            {round.display_ts}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>
            {displayName(round.id)}
          </div>
        </div>
        <DecisionDonut counts={counts} size={42} />
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10, position: 'relative' }}>
        <PersonaBadge id={round.persona} size="sm" />
        <SectionTag id={round.section} />
        {round.model && (
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10,
              color: 'var(--ink-3)',
              padding: '2px 6px',
              background: 'var(--surface-2)',
              borderRadius: 3,
            }}
          >
            {round.model}
          </span>
        )}
        {round.status === 'in-progress' && (
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 9.5,
              fontWeight: 700,
              color: 'var(--accent)',
              padding: '2px 6px',
              background: 'var(--accent-bg)',
              borderRadius: 3,
              letterSpacing: 0.5,
            }}
          >
            IN PROGRESS
          </span>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
          position: 'relative',
        }}
      >
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
          R항목 {total}
        </span>
        {total > 0 && (
          <>
            <div
              style={{
                flex: 1,
                height: 4,
                background: 'var(--surface-2)',
                borderRadius: 2,
                overflow: 'hidden',
                display: 'flex',
              }}
            >
              <div
                style={{
                  width: `${(recModified / total) * 100}%`,
                  background: 'var(--accent)',
                  height: '100%',
                }}
                title={`modified ${recModified}`}
              />
              <div
                style={{
                  width: `${(recOriginal / total) * 100}%`,
                  background: 'var(--ink-4)',
                  height: '100%',
                }}
                title={`original ${recOriginal}`}
              />
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
              {recModified}m / {recOriginal}o
            </span>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, position: 'relative' }}>
        {(['apply', 'skip', 'reject', 'pending'] as const).map((k) => {
          const v = counts[k];
          if (!v) return null;
          const c =
            k === 'apply'
              ? 'var(--ok)'
              : k === 'skip'
                ? 'var(--mute)'
                : k === 'reject'
                  ? 'var(--warn)'
                  : 'var(--ink-4)';
          return (
            <span
              key={k}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'var(--mono)',
                fontSize: 10,
                color: c,
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: 3, background: c }} />
              {k} {v}
            </span>
          );
        })}
      </div>
    </Card>
  );
}

function displayName(id: string): string {
  const m = id.match(/_round_(\d+)$/);
  return m ? `Round ${m[1]}` : id;
}
