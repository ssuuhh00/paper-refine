import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ErrorNote, Persona } from '@paper-refine/shared';
import { Card } from '../components/ui/Card';
import { PersonaBadge } from '../components/round/PersonaBadge';
import { SectionTag } from '../components/round/SectionTag';
import { PERSONAS, PERSONA_KEYS } from '../data/personas';
import { useProjects } from '../state/ProjectContext';
import { api } from '../lib/api';

type SourceFilter = 'all' | 'user' | 'discriminator';

export function ErrorNotesPage() {
  const { current } = useProjects();
  const [notes, setNotes] = useState<ErrorNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SourceFilter>('all');

  useEffect(() => {
    if (!current) return;
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .listErrorNotes(current.id)
      .then((n) => alive && setNotes(n))
      .catch((err) => alive && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [current?.id]);

  const filtered = useMemo(
    () => (filter === 'all' ? notes : notes.filter((n) => n.source === filter)),
    [notes, filter],
  );

  const personaCounts = useMemo(() => {
    const acc: Record<Persona, number> = { ieee: 0, outsider: 0, writing: 0, structure: 0 };
    for (const n of notes) {
      if (n.persona) acc[n.persona]++;
    }
    return acc;
  }, [notes]);

  const userCount = notes.filter((n) => n.source === 'user').length;
  const discCount = notes.length - userCount;

  if (!current) {
    return (
      <div style={{ flex: 1, padding: 28, maxWidth: 920, margin: '0 auto', width: '100%' }}>
        <Card style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>
          현재 선택된 프로젝트가 없습니다.{' '}
          <Link to="/projects" style={{ color: 'var(--accent)' }}>
            프로젝트 등록 →
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '24px 28px 60px' }}>
        <header style={{ marginBottom: 22 }}>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--warn)',
              letterSpacing: 0.6,
              marginBottom: 6,
            }}
          >
            ERROR NOTES
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.4, margin: 0 }}>
            오답노트
          </h1>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '6px 0 0' }}>
            거부된 수정안의 사유 — 사용자 거부 + Discriminator 거부 누적.{' '}
            <span style={{ fontFamily: 'var(--mono)' }}>{current.error_notes_path}</span>에
            기록됩니다.
          </p>
        </header>

        {error && (
          <Card
            style={{
              padding: '10px 14px',
              marginBottom: 14,
              borderColor: 'var(--warn)',
              background: 'var(--warn-bg)',
            }}
          >
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--warn)' }}>
              {error}
            </div>
          </Card>
        )}

        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 18,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <SourcePill k="all" cur={filter} setCur={setFilter} count={notes.length}>
            전체
          </SourcePill>
          <SourcePill k="user" cur={filter} setCur={setFilter} count={userCount} color="var(--warn)">
            사용자 거부
          </SourcePill>
          <SourcePill
            k="discriminator"
            cur={filter}
            setCur={setFilter}
            count={discCount}
            color="var(--accent)"
          >
            Discriminator 거부
          </SourcePill>
        </div>

        {loading && notes.length === 0 ? (
          <Card style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>
            불러오는 중…
          </Card>
        ) : notes.length === 0 ? (
          <EmptyNotes />
        ) : filtered.length === 0 ? (
          <Card style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>
            조건에 맞는 항목이 없습니다.
          </Card>
        ) : (
          <Timeline notes={filtered} />
        )}

        {notes.length > 0 && (
          <Card style={{ padding: 14, marginTop: 22 }}>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 10.5,
                color: 'var(--ink-3)',
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              페르소나별 거부 빈도
            </div>
            {PERSONA_KEYS.map((k) => {
              const p = PERSONAS[k];
              const cnt = personaCounts[k];
              const max = Math.max(...Object.values(personaCounts), 1);
              return (
                <div
                  key={k}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      width: 70,
                      color: 'var(--ink-2)',
                    }}
                  >
                    {p.short}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      background: 'var(--surface-2)',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${(cnt / max) * 100}%`,
                        background: `oklch(0.55 0.13 ${p.hue})`,
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      color: 'var(--ink-3)',
                      width: 16,
                      textAlign: 'right',
                    }}
                  >
                    {cnt}
                  </span>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}

function Timeline({ notes }: { notes: ErrorNote[] }) {
  return (
    <div style={{ position: 'relative', paddingLeft: 20 }}>
      <div
        style={{
          position: 'absolute',
          left: 5,
          top: 8,
          bottom: 8,
          width: 1,
          background: 'var(--border)',
        }}
      />
      {notes.map((n, i) => {
        const isUser = n.source === 'user';
        const color = isUser ? 'var(--warn)' : 'var(--accent)';
        const bg = isUser ? 'var(--warn-bg)' : 'var(--accent-bg)';
        return (
          <Link
            key={`${n.round}-${n.key}-${n.source}-${i}`}
            to={`/rounds/${n.round}`}
            style={{
              display: 'block',
              position: 'relative',
              marginBottom: 14,
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: -20,
                top: 12,
                width: 11,
                height: 11,
                borderRadius: 6,
                background: 'var(--bg)',
                border: `2px solid ${color}`,
              }}
            />
            <Card style={{ padding: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 6,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    color,
                    padding: '2px 6px',
                    background: bg,
                    borderRadius: 3,
                  }}
                >
                  {n.source.toUpperCase()}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}>
                  {n.r}
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
                  {shortRound(n.round)}
                </span>
                <SectionTag id={n.section} />
                <PersonaBadge id={n.persona} size="sm" />
                <span style={{ flex: 1 }} />
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
                  {n.date}
                </span>
              </div>
              {n.title && (
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'var(--ink)',
                    marginBottom: 4,
                  }}
                >
                  {n.title}
                </div>
              )}
              {n.reason ? (
                <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                  {n.reason}
                </div>
              ) : (
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--ink-4)',
                    fontStyle: 'italic',
                  }}
                >
                  (사유 미작성)
                </div>
              )}
              <div
                style={{
                  marginTop: 8,
                  fontFamily: 'var(--mono)',
                  fontSize: 10.5,
                  color: 'var(--accent)',
                }}
              >
                → 라운드 {shortRound(n.round)} · {n.key}로 이동
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function SourcePill({
  k,
  cur,
  setCur,
  children,
  count,
  color,
}: {
  k: SourceFilter;
  cur: SourceFilter;
  setCur: (k: SourceFilter) => void;
  children: React.ReactNode;
  count: number;
  color?: string;
}) {
  const sel = cur === k;
  return (
    <button
      onClick={() => setCur(k)}
      style={{
        padding: '5px 11px',
        border: '1px solid ' + (sel ? 'var(--ink)' : 'var(--border)'),
        background: sel ? 'var(--surface-2)' : 'transparent',
        color: 'var(--ink-2)',
        borderRadius: 4,
        fontSize: 11.5,
        fontFamily: 'var(--mono)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {color && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: color,
          }}
        />
      )}
      {children}
      <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{count}</span>
    </button>
  );
}

function EmptyNotes() {
  return (
    <Card style={{ padding: '40px 24px', textAlign: 'center' }}>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--ink-3)',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        no rejections yet
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>
        아직 거부된 항목이 없습니다.
      </h2>
      <p style={{ fontSize: 12.5, color: 'var(--ink-3)', maxWidth: 440, margin: '0 auto' }}>
        라운드 워크스페이스에서 R 항목을 <strong>REJECT</strong>로 결정하거나, Discriminator가
        원문을 선택했을 때 이곳에 누적됩니다.
      </p>
    </Card>
  );
}

function shortRound(id: string): string {
  const m = id.match(/_round_(\d+)$/);
  return m ? `R${m[1]}` : id;
}
