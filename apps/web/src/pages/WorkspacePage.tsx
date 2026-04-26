import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { DecisionState, RoundItem } from '@paper-refine/shared';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { PersonaBadge } from '../components/round/PersonaBadge';
import { SectionTag } from '../components/round/SectionTag';
import { DecisionStamp } from '../components/round/DecisionStamp';
import { Stepper, STEPS, type StepKey } from '../components/round/Stepper';
import { DiffViewer, type DiffMode } from '../components/round/DiffViewer';
import { DecisionBar } from '../components/round/DecisionBar';
import { ApplyModal } from '../components/round/ApplyModal';
import { useProjects } from '../state/ProjectContext';
import { useRound } from '../state/useRound';

type Filter = 'all' | 'pending' | 'reject';

function primarySection(item: RoundItem): string {
  const set = new Set(item.edits.map((e) => e.file));
  if (set.size === 0) return '?';
  if (set.size === 1) return [...set][0]!;
  return 'multi';
}

export function WorkspacePage() {
  const { roundId } = useParams<{ roundId: string }>();
  const { current } = useProjects();
  const { round, loading, error, setDecision, reload } = useRound(
    current?.id ?? null,
    roundId ?? null,
  );

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [step, setStep] = useState<StepKey>('verdict');
  const [diffMode, setDiffMode] = useState<DiffMode>('split');
  const [filter, setFilter] = useState<Filter>('all');
  const [showApply, setShowApply] = useState(false);

  useEffect(() => {
    if (!round || activeKey) return;
    const firstPending = round.items.find((i) => round.decisions[i.r]?.state === 'pending');
    setActiveKey((firstPending ?? round.items[0])?.r ?? null);
  }, [round, activeKey]);

  const filteredItems = useMemo(() => {
    if (!round) return [];
    return round.items.filter((i) => {
      const d = round.decisions[i.r]?.state ?? 'pending';
      if (filter === 'pending') return d === 'pending';
      if (filter === 'reject') return d === 'reject';
      return true;
    });
  }, [round, filter]);

  const item = useMemo(
    () => round?.items.find((i) => i.r === activeKey) ?? null,
    [round, activeKey],
  );

  const counts = useMemo(() => {
    const acc = { apply: 0, skip: 0, reject: 0, pending: 0 };
    if (!round) return acc;
    for (const it of round.items) {
      const s = (round.decisions[it.r]?.state ?? 'pending') as DecisionState;
      acc[s]++;
    }
    return acc;
  }, [round]);

  const moveItem = (delta: number) => {
    if (!round || !activeKey) return;
    const idx = round.items.findIndex((i) => i.r === activeKey);
    const next = round.items[Math.max(0, Math.min(round.items.length - 1, idx + delta))];
    if (next) setActiveKey(next.r);
  };

  const goToStep = (k: StepKey) => {
    setStep(k);
    document
      .getElementById(`step-${k}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const moveStep = (delta: number) => {
    const idx = STEPS.findIndex((s) => s.k === step);
    const next = STEPS[Math.max(0, Math.min(STEPS.length - 1, idx + delta))];
    if (next) goToStep(next.k);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (!item) return;
      const k = e.key.toLowerCase();
      if (k === 'a') setDecision(item.r, { state: 'apply' });
      else if (k === 's') setDecision(item.r, { state: 'skip' });
      else if (k === 'r') setDecision(item.r, { state: 'reject' });
      else if (e.key === 'ArrowLeft') moveItem(-1);
      else if (e.key === 'ArrowRight') moveItem(1);
      else if (e.key === 'ArrowUp') moveStep(-1);
      else if (e.key === 'ArrowDown') moveStep(1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [item, step]);

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

  if (loading || !round) {
    return (
      <div style={{ flex: 1, padding: 28, maxWidth: 920, margin: '0 auto', width: '100%' }}>
        <Card style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>
          {error ? <span style={{ color: 'var(--warn)' }}>{error}</span> : '불러오는 중…'}
        </Card>
      </div>
    );
  }

  if (!item) {
    return (
      <div style={{ flex: 1, padding: 28 }}>
        <Card style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>
          이 라운드에는 R 항목이 없습니다.
        </Card>
      </div>
    );
  }

  const decision = round.decisions[item.r] ?? { state: 'pending' as const };
  const recommendsModified = item.blind[item.verdict.pick] === 'modified';
  const itemSection = primarySection(item);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Link
          to="/"
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--ink-3)',
            textDecoration: 'none',
          }}
        >
          ← 라운드 인덱스
        </Link>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: -0.2 }}>
            {displayRoundName(round.id)}
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--ink-3)',
              marginTop: 2,
              fontFamily: 'var(--mono)',
            }}
          >
            {counts.apply + counts.skip + counts.reject}/{round.items.length} 결정 · 적용{' '}
            {counts.apply} · 보류 {counts.skip} · 거부 {counts.reject} · 미결정 {counts.pending}
          </div>
        </div>
        <Stepper active={step} onPick={goToStep} compact />
        <div style={{ flex: 1 }} />
        <PersonaBadge id={round.persona} />
        <SectionTag id={round.section} full />
        <Button variant="primary" onClick={() => setShowApply(true)}>
          Apply selected to .tex{' '}
          <span style={{ fontFamily: 'var(--mono)', opacity: 0.85 }}>{counts.apply}</span>
        </Button>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <aside
          style={{
            width: 280,
            borderRight: '1px solid var(--border)',
            background: 'var(--surface)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--border)' }}>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                color: 'var(--ink-3)',
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              R 항목 · {round.items.length}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'pending', 'reject'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    flex: 1,
                    padding: '5px 8px',
                    border: '1px solid ' + (filter === f ? 'var(--ink)' : 'var(--border)'),
                    background: filter === f ? 'var(--ink)' : 'transparent',
                    color: filter === f ? 'var(--bg)' : 'var(--ink-2)',
                    borderRadius: 5,
                    fontSize: 11,
                    fontFamily: 'var(--mono)',
                    cursor: 'pointer',
                  }}
                >
                  {f === 'all' ? '전체' : f === 'pending' ? '미결정' : '거부'}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {filteredItems.map((it) => {
              const isActive = it.r === activeKey;
              const dec = round.decisions[it.r];
              const d = (dec?.state ?? 'pending') as DecisionState;
              const isApplied = !!dec?.applied_at;
              const recModified = it.blind[it.verdict.pick] === 'modified';
              return (
                <button
                  key={it.r}
                  onClick={() => setActiveKey(it.r)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    background: isActive ? 'var(--surface-2)' : 'transparent',
                    border: 'none',
                    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    borderBottom: '1px solid var(--border-soft)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--ink)',
                      }}
                    >
                      {it.r}
                      {it.edits.length > 1 && (
                        <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>
                          {' ·'} {it.edits.length} edits
                        </span>
                      )}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {isApplied && (
                        <span
                          title={`applied at ${dec?.applied_at}`}
                          style={{
                            fontFamily: 'var(--mono)',
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            color: 'var(--accent)',
                            padding: '1px 5px',
                            background: 'var(--accent-bg)',
                            borderRadius: 3,
                          }}
                        >
                          ✓ APPLIED
                        </span>
                      )}
                      <DecisionStamp state={d} size="sm" />
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: isActive ? 'var(--ink)' : 'var(--ink-2)',
                      lineHeight: 1.4,
                    }}
                  >
                    {it.title || '(제목 없음)'}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontFamily: 'var(--mono)',
                      fontSize: 10,
                      color: 'var(--ink-3)',
                    }}
                  >
                    <span>{recModified ? '→ modified' : '→ original'}</span>
                    <span>·</span>
                    <span>pick {it.verdict.pick}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <div style={{ padding: '24px 32px 60px', maxWidth: 1100, margin: '0 auto' }}>
            <div style={{ marginBottom: 18 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 6,
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  color: 'var(--ink-3)',
                }}
              >
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{item.r}</span>
                {item.severity && (
                  <>
                    <span>·</span>
                    <span style={{ color: severityColor(item.severity) }}>{item.severity}</span>
                  </>
                )}
                <span>·</span>
                <SectionTag id={itemSection} />
                <span>·</span>
                <span>{item.edits.length} edits</span>
                {decision.applied_at && (
                  <span
                    title={`applied at ${decision.applied_at}`}
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 0.5,
                      color: 'var(--accent)',
                      padding: '1px 6px',
                      background: 'var(--accent-bg)',
                      borderRadius: 3,
                    }}
                  >
                    ✓ APPLIED to .tex
                  </span>
                )}
              </div>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 600,
                  letterSpacing: -0.4,
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {item.title || '(제목 없음)'}
              </h1>
            </div>

            <Section step="1" stepKey="review" label="Review" ko="리뷰어 지적">
              <ReviewView item={item} />
            </Section>

            <Section step="2" stepKey="changes" label="Changes" ko={`원문 ↔ 수정안 (${item.edits.length})`}>
              <RuleHeader item={item} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 10px' }}>
                {(['split', 'unified'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setDiffMode(m)}
                    style={{
                      padding: '4px 10px',
                      border: '1px solid ' + (diffMode === m ? 'var(--ink)' : 'var(--border)'),
                      background: diffMode === m ? 'var(--ink)' : 'transparent',
                      color: diffMode === m ? 'var(--bg)' : 'var(--ink-2)',
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: 'var(--mono)',
                      cursor: 'pointer',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {item.edits.length === 0 ? (
                <Card style={{ padding: 14, color: 'var(--ink-3)', fontSize: 12.5 }}>
                  이 R에 대한 edit이 비어 있습니다 (Generator가 수정 불필요로 판단).
                </Card>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {item.edits.map((edit, i) => (
                    <div key={i}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 8,
                          fontFamily: 'var(--mono)',
                          fontSize: 11,
                          color: 'var(--ink-3)',
                        }}
                      >
                        <span
                          style={{
                            padding: '2px 6px',
                            background: 'var(--surface-2)',
                            borderRadius: 3,
                            color: 'var(--ink-2)',
                            fontWeight: 600,
                          }}
                        >
                          {i + 1}/{item.edits.length}
                        </span>
                        <SectionTag id={edit.file} full />
                      </div>
                      <DiffViewer
                        original={edit.original}
                        modified={edit.modified}
                        mode={diffMode}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section step="3" stepKey="verdict" label="Blind + Verdict" ko="블라인드 셔플 후 Discriminator 판정">
              <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
                <Card
                  style={{
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 180,
                    background: 'var(--ok-bg)',
                    borderColor: 'var(--ok)',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10,
                      color: 'var(--ok)',
                      letterSpacing: 0.6,
                      marginBottom: 6,
                    }}
                  >
                    PICK
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 26,
                      fontWeight: 700,
                      color: 'var(--ok)',
                      lineHeight: 1.1,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase',
                    }}
                  >
                    {item.blind[item.verdict.pick]}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10,
                      color: 'var(--ok)',
                      opacity: 0.7,
                      marginTop: 6,
                    }}
                  >
                    blind {item.verdict.pick}
                  </div>
                </Card>
                <Card style={{ flex: 1, padding: 14 }}>
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 10.5,
                      color: 'var(--ink-3)',
                      letterSpacing: 0.5,
                      marginBottom: 4,
                    }}
                  >
                    사유 — 이 R의 {item.edits.length}개 edit 묶음 전체에 대한 판정
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink)' }}>
                    {(recommendsModified ? item.verdict.reason : item.verdict.loserReason) ||
                      '(사유 없음)'}
                  </div>
                </Card>
              </div>
              <div
                style={{
                  marginTop: 12,
                  padding: '10px 14px',
                  background: 'var(--accent-bg)',
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    color: 'var(--accent)',
                    letterSpacing: 0.6,
                    fontWeight: 700,
                  }}
                >
                  최종 추천
                </span>
                <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
                  {recommendsModified
                    ? `수정안 채택 — ${item.edits.length}개 edit 일괄 반영`
                    : '원문 유지 (수정안 거부)'}
                </span>
              </div>
            </Section>

            <div style={{ height: 24 }} />
          </div>

          <DecisionBar
            item={item}
            decision={decision}
            showKbdHints
            onDecide={(state, extra) => {
              setDecision(item.r, {
                state,
                ...(extra?.reason !== undefined ? { reason: extra.reason } : {}),
                ...(extra?.memo !== undefined ? { memo: extra.memo } : {}),
              });
            }}
            onPrev={() => moveItem(-1)}
            onNext={() => moveItem(1)}
          />
        </main>
      </div>

      {showApply && current && roundId && (
        <ApplyModal
          projectId={current.id}
          roundId={roundId}
          items={round.items}
          decisions={round.decisions}
          onClose={() => setShowApply(false)}
          onApplied={() => {
            void reload();
          }}
        />
      )}
    </div>
  );
}

function Section({
  step,
  stepKey,
  label,
  ko,
  children,
}: {
  step: string;
  stepKey: StepKey;
  label: string;
  ko: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`step-${stepKey}`} style={{ marginBottom: 30, scrollMarginTop: 16 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
          marginBottom: 12,
          paddingBottom: 8,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--bg)',
            background: 'var(--ink)',
            padding: '2px 7px',
            borderRadius: 3,
            letterSpacing: 0.5,
          }}
        >
          STEP {step}
        </span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{ko}</span>
      </header>
      {children}
    </section>
  );
}

function ReviewView({ item }: { item: RoundItem }) {
  const hasContent = item.concern || item.citations.length > 0;
  if (!hasContent) {
    return (
      <Card style={{ padding: 14, color: 'var(--ink-3)', fontSize: 12.5 }}>
        리뷰 데이터가 비어 있습니다.
      </Card>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {item.concern && (
        <div>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              color: 'var(--ink-3)',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Concern
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>{item.concern}</div>
        </div>
      )}
      {item.citations.length > 0 && (
        <div>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              color: 'var(--ink-3)',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Citations · {item.citations.length}개 위치
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {item.citations.map((c, i) => (
              <Card key={i} style={{ padding: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: 'var(--ink-3)',
                  }}
                >
                  <span
                    style={{
                      padding: '2px 6px',
                      background: 'var(--surface-2)',
                      borderRadius: 3,
                      fontWeight: 600,
                      color: 'var(--ink-2)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <SectionTag id={c.file} full />
                  {c.note && (
                    <span style={{ color: 'var(--ink-3)', fontFamily: 'var(--sans)' }}>
                      — {c.note}
                    </span>
                  )}
                </div>
                <blockquote
                  style={{
                    margin: 0,
                    padding: '8px 12px',
                    background: 'var(--surface-2)',
                    borderLeft: '3px solid var(--ink-4)',
                    fontFamily: 'var(--mono)',
                    fontSize: 12,
                    lineHeight: 1.55,
                    color: 'var(--ink-2)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {c.snippet}
                </blockquote>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RuleHeader({ item }: { item: RoundItem }) {
  if (!item.rule && !item.rationale) return null;
  return (
    <Card style={{ padding: 14 }}>
      {item.rule && (
        <div style={{ marginBottom: item.rationale ? 8 : 0 }}>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              color: 'var(--ink-3)',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Rule
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.rule}</div>
        </div>
      )}
      {item.rationale && (
        <div>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              color: 'var(--ink-3)',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Rationale
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-2)' }}>
            {item.rationale}
          </div>
        </div>
      )}
    </Card>
  );
}

function severityColor(s: NonNullable<RoundItem['severity']>): string {
  if (s === 'critical') return 'var(--warn)';
  if (s === 'major') return 'var(--accent)';
  return 'var(--ink-3)';
}

function displayRoundName(id: string): string {
  const m = id.match(/_round_(\d+)$/);
  return m ? `Round ${m[1]}` : id;
}
