import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { ModelTier, Persona, PipelineEvent, RunRequest } from '@paper-refine/shared';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { useProjects } from '../state/ProjectContext';
import { api } from '../lib/api';
import { PERSONAS, PERSONA_KEYS } from '../data/personas';
import { useRunStream } from '../state/useRunStream';
import { useActiveRun } from '../state/useActiveRun';

const MODELS: ModelTier[] = ['haiku', 'sonnet', 'opus'];

const STAGES: { k: 'review' | 'changes' | 'blind' | 'verdict'; label: string; desc: string }[] = [
  { k: 'review', label: 'Reviewer', desc: '페르소나로 지적사항 추출' },
  { k: 'changes', label: 'Generator', desc: '원문/수정안 LaTeX 쌍 작성' },
  { k: 'blind', label: 'Blind Shuffle', desc: 'A/B 무작위 셔플 + mapping' },
  { k: 'verdict', label: 'Discriminator', desc: '블라인드 판정 + 추천' },
];

export function LauncherPage() {
  const { current } = useProjects();
  const [params, setParams] = useSearchParams();
  const runId = params.get('run');
  const activeRun = useActiveRun();

  // If we land on /launch without a ?run= but a run is active, jump to it.
  // Same hook fires when a different run becomes active mid-session.
  useEffect(() => {
    if (runId) return;
    if (activeRun && activeRun !== runId) {
      const next = new URLSearchParams(params);
      next.set('run', activeRun);
      setParams(next, { replace: true });
    }
  }, [runId, activeRun]);

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

  if (runId) {
    return (
      <RunningView
        runId={runId}
        onBackToForm={() => {
          params.delete('run');
          setParams(params, { replace: true });
        }}
      />
    );
  }

  return (
    <LauncherForm
      onStarted={(id) => {
        const next = new URLSearchParams(params);
        next.set('run', id);
        setParams(next, { replace: true });
      }}
      onActiveDetected={(id) => {
        const next = new URLSearchParams(params);
        next.set('run', id);
        setParams(next, { replace: true });
      }}
    />
  );
}

function LauncherForm({
  onStarted,
  onActiveDetected,
}: {
  onStarted: (runId: string) => void;
  onActiveDetected: (runId: string) => void;
}) {
  const { current } = useProjects();
  const [persona, setPersona] = useState<Persona>('ieee');
  const [model, setModel] = useState<ModelTier>('sonnet');
  const [rounds, setRounds] = useState(1);
  const [dryRun, setDryRun] = useState(false);
  const [sections, setSections] = useState<string[]>([]);
  const [available, setAvailable] = useState<{ rel: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!current) return;
    api
      .listSections(current.id)
      .then((r) => {
        setAvailable(r.sections);
        setSections(r.sections.map((s) => s.name));
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [current?.id]);

  const allOn = sections.length === available.length && available.length > 0;
  const toggleAll = () => setSections(allOn ? [] : available.map((s) => s.name));
  const toggle = (n: string) =>
    setSections((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  const cmdPreview = useMemo(() => {
    const sel = allOn
      ? 'all'
      : sections.length === 1
        ? sections[0]
        : sections.join(',');
    return `paper-refine run --persona ${persona} --sections "${sel || '<none>'}" --rounds ${rounds} --model ${model}${dryRun ? ' --dry-run' : ''}`;
  }, [persona, sections, allOn, rounds, model, dryRun]);

  const submit = async () => {
    if (!current || sections.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const req: RunRequest = {
        project_id: current.id,
        persona,
        sections,
        rounds,
        model,
        dry_run: dryRun,
      };
      const res = await api.startRun(req);
      onStarted(res.run_id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Fastify returns the json body in the error message; pull active id out
      // so we can jump the user to the running view instead of leaving them
      // stuck on the form.
      const m = msg.match(/"active"\s*:\s*"([^"]+)"/);
      if (m?.[1]) {
        onActiveDetected(m[1]);
        return;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 28px 60px' }}>
        <header style={{ marginBottom: 28 }}>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: 'var(--accent)',
              letterSpacing: 0.6,
              marginBottom: 6,
            }}
          >
            NEW ROUND · {current?.name}
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.5, margin: 0 }}>
            라운드 실행
          </h1>
          <p
            style={{ fontSize: 13, color: 'var(--ink-3)', margin: '6px 0 0', lineHeight: 1.55 }}
          >
            Reviewer → Generator → Blind → Discriminator 4단계를 순차 실행합니다. 진행 과정은 같은
            화면에서 인플레이스로 노출됩니다.
          </p>
        </header>

        {error && <ErrorBanner msg={error} />}

        <Field label="페르소나" desc="Reviewer가 어떤 관점으로 지적할지 결정합니다.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {PERSONA_KEYS.map((k) => {
              const p = PERSONAS[k];
              const sel = persona === k;
              return (
                <button
                  key={k}
                  onClick={() => setPersona(k)}
                  style={{
                    padding: '12px 14px',
                    textAlign: 'left',
                    border: sel
                      ? `1.5px solid oklch(0.55 0.15 ${p.hue})`
                      : '1px solid var(--border)',
                    background: sel ? `oklch(0.97 0.02 ${p.hue})` : 'var(--surface)',
                    borderRadius: 7,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 8,
                        background: `oklch(0.55 0.15 ${p.hue})`,
                      }}
                    />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>
                      {p.short}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{p.ko}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{p.desc}</div>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="섹션" desc={`검토할 .tex 파일 (다중 선택) — ${available.length}개 발견`}>
          {available.length === 0 ? (
            <Card style={{ padding: 14, color: 'var(--ink-3)', fontSize: 12.5 }}>
              매칭되는 섹션이 없습니다. 프로젝트의 LaTeX 루트와 글롭을 확인하세요.
            </Card>
          ) : (
            <>
              <div style={{ marginBottom: 8 }}>
                <button
                  onClick={toggleAll}
                  style={{
                    padding: '4px 10px',
                    border: '1px solid var(--border)',
                    background: allOn ? 'var(--ink)' : 'transparent',
                    color: allOn ? 'var(--bg)' : 'var(--ink-2)',
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: 'var(--mono)',
                    cursor: 'pointer',
                  }}
                >
                  {allOn ? '✓ 전체' : '전체'}
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {available.map((s) => {
                  const checked = sections.includes(s.name);
                  return (
                    <label
                      key={s.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        border: '1px solid var(--border)',
                        background: checked ? 'var(--surface-2)' : 'var(--surface)',
                        borderRadius: 5,
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          border: '1.5px solid ' + (checked ? 'var(--accent)' : 'var(--border)'),
                          background: checked ? 'var(--accent)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-fg)',
                          fontSize: 9,
                        }}
                      >
                        {checked ? '✓' : ''}
                      </span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)' }}>
                        {s.name}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(s.name)}
                        style={{ display: 'none' }}
                      />
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </Field>

        <Field label="라운드 수" desc="동일 섹션 묶음을 몇 번 반복할지">
          <NumberStepper value={rounds} min={1} max={10} onChange={setRounds} />
        </Field>

        <Field label="모델">
          <div style={{ display: 'flex', gap: 6 }}>
            {MODELS.map((m) => {
              const sel = model === m;
              return (
                <button
                  key={m}
                  onClick={() => setModel(m)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    border: '1px solid ' + (sel ? 'var(--ink)' : 'var(--border)'),
                    background: sel ? 'var(--ink)' : 'var(--surface)',
                    color: sel ? 'var(--bg)' : 'var(--ink-2)',
                    borderRadius: 5,
                    fontSize: 12,
                    fontFamily: 'var(--mono)',
                    cursor: 'pointer',
                    fontWeight: sel ? 600 : 500,
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </Field>

        <Field>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              border: '1px solid var(--border)',
              borderRadius: 5,
              cursor: 'pointer',
              background: dryRun ? 'var(--surface-2)' : 'var(--surface)',
            }}
          >
            <span
              style={{
                width: 32,
                height: 18,
                borderRadius: 9,
                background: dryRun ? 'var(--accent)' : 'var(--border)',
                position: 'relative',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  left: dryRun ? 16 : 2,
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  background: '#fff',
                  transition: 'left 0.15s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                }}
              />
            </span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>Dry-run</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                claude 호출 없이 실행 계획만 확인
              </div>
            </div>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={() => setDryRun(!dryRun)}
              style={{ display: 'none' }}
            />
          </label>
        </Field>

        <Field label="예상 명령">
          <pre
            style={{
              margin: 0,
              padding: '12px 14px',
              background: '#0e0d0a',
              color: '#d4cdb8',
              borderRadius: 6,
              fontFamily: 'var(--mono)',
              fontSize: 11.5,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              border: '1px solid var(--border)',
            }}
          >
            <span style={{ color: '#7a7458' }}>$ </span>
            {cmdPreview}
          </pre>
        </Field>

        <Button
          variant="primary"
          onClick={submit}
          disabled={submitting || sections.length === 0}
          style={{
            width: '100%',
            padding: '14px 20px',
            fontSize: 14,
          }}
        >
          {submitting ? '시작 중…' : dryRun ? 'Dry-run 미리보기' : '▶ 실행'}
        </Button>
      </div>
    </div>
  );
}

function NumberStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const btn = {
    width: 36,
    height: 32,
    border: 'none',
    background: 'transparent',
    color: 'var(--ink-2)',
    fontSize: 16,
    cursor: 'pointer',
    fontFamily: 'var(--mono)',
  } as const;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        border: '1px solid var(--border)',
        borderRadius: 5,
        width: 'fit-content',
        overflow: 'hidden',
        background: 'var(--surface)',
      }}
    >
      <button onClick={() => onChange(Math.max(min, value - 1))} style={btn}>
        −
      </button>
      <div
        style={{
          width: 60,
          textAlign: 'center',
          fontFamily: 'var(--mono)',
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        {value}
      </div>
      <button onClick={() => onChange(Math.min(max, value + 1))} style={btn}>
        +
      </button>
    </div>
  );
}

function RunningView({ runId, onBackToForm }: { runId: string; onBackToForm: () => void }) {
  const { events, run, status } = useRunStream(runId);
  const consoleRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [events.length]);

  // stage progression — derive from latest event
  const currentStage = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i]!;
      if (e.stage !== 'done') return e.stage;
    }
    return 'review';
  }, [events]);
  const stageIdx = STAGES.findIndex((s) => s.k === currentStage);
  const isDone = run?.status === 'completed' || run?.status === 'failed';

  // per-stage counters
  const counters = useMemo(() => {
    const map: Record<'review' | 'changes' | 'blind' | 'verdict', number> = {
      review: 0,
      changes: 0,
      blind: 0,
      verdict: 0,
    };
    for (const e of events) {
      if (e.type === 'item' && e.stage === 'review') map.review++;
      else if (e.type === 'pair' && e.stage === 'changes') map.changes++;
      else if (e.type === 'map' && e.stage === 'blind') map.blind++;
      else if (e.type === 'pick' && e.stage === 'verdict') map.verdict++;
    }
    return map;
  }, [events]);

  const totalEvents = events.length;
  const errorEv = events.find((e) => e.type === 'error');
  const completedRoundIds = run?.round_ids ?? [];

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 920,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <Button variant="secondary" size="sm" onClick={onBackToForm}>
            ← 폼 수정
          </Button>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 8,
              background: isDone
                ? run?.status === 'failed'
                  ? 'var(--warn)'
                  : 'var(--ok)'
                : 'var(--accent)',
              animation: isDone ? 'none' : 'pulse 1.4s infinite',
            }}
          />
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>
              {runId} ·{' '}
              {run?.status ?? (status === 'connecting' ? '연결 중' : status)}
            </div>
            {run && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
                {run.request.persona} · {run.request.sections.length} files ·{' '}
                {run.request.rounds}r · {run.request.model}
                {run.request.dry_run ? ' · dry-run' : ''}
              </div>
            )}
          </div>
          <div style={{ flex: 1 }} />
          {isDone && completedRoundIds.length > 0 && (
            <Button
              variant="primary"
              onClick={() => navigate(`/rounds/${completedRoundIds[completedRoundIds.length - 1]}`)}
            >
              → 결과 보기
            </Button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 24px 60px' }}>
        {errorEv && (
          <Card
            style={{
              padding: '12px 16px',
              marginBottom: 18,
              borderColor: 'var(--warn)',
              background: 'var(--warn-bg)',
            }}
          >
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--warn)' }}>
              {(errorEv as Extract<PipelineEvent, { type: 'error' }>).msg}
            </div>
          </Card>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
            marginBottom: 18,
          }}
        >
          {STAGES.map((s, i) => {
            const active = !isDone && i === stageIdx;
            const done = isDone || i < stageIdx;
            return (
              <div
                key={s.k}
                style={{
                  padding: '12px 14px',
                  background: 'var(--surface)',
                  border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                  borderRadius: 7,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {active && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 2,
                      background: 'var(--accent)',
                      animation: 'progressBar 1.4s ease-in-out infinite',
                    }}
                  />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      background: done ? 'var(--ok)' : active ? 'var(--accent)' : 'var(--surface-2)',
                      color: done || active ? 'var(--bg)' : 'var(--ink-3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: 'var(--mono)',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}>
                    {s.label}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: 'var(--ink-3)',
                    marginBottom: 8,
                    lineHeight: 1.4,
                  }}
                >
                  {s.desc}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 18,
                      fontWeight: 600,
                      color: done ? 'var(--ok)' : active ? 'var(--accent)' : 'var(--ink-4)',
                    }}
                  >
                    {counters[s.k]}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                    {{ review: 'R-items', changes: 'pairs', blind: 'maps', verdict: 'picks' }[s.k]}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <Card style={{ overflow: 'hidden', padding: 0 }}>
          <div
            style={{
              padding: '8px 14px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'flex', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: '#e85751' }} />
                <span style={{ width: 8, height: 8, borderRadius: 4, background: '#e9b22e' }} />
                <span style={{ width: 8, height: 8, borderRadius: 4, background: '#5db95d' }} />
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                pipeline · live output
              </span>
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
              {totalEvents} events
            </span>
          </div>
          <div
            ref={consoleRef}
            style={{
              background: '#0e0d0a',
              color: '#d4cdb8',
              padding: '12px 14px',
              height: 320,
              overflowY: 'auto',
              fontFamily: 'var(--mono)',
              fontSize: 11.5,
              lineHeight: 1.6,
            }}
          >
            {events.map((e, i) => {
              const text = formatEvent(e);
              const c = colorFor(e);
              return (
                <div key={i} style={{ color: c, whiteSpace: 'pre-wrap' }}>
                  {text}
                </div>
              );
            })}
            {!isDone && (
              <div style={{ color: '#a6d189', animation: 'blink 1s step-end infinite' }}>▎</div>
            )}
          </div>
        </Card>

        {completedRoundIds.length > 0 && (
          <div style={{ marginTop: 18 }}>
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
              생성된 라운드
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {completedRoundIds.map((rid) => (
                <Link
                  key={rid}
                  to={`/rounds/${rid}`}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    borderRadius: 5,
                    fontFamily: 'var(--mono)',
                    fontSize: 11.5,
                    color: 'var(--ink)',
                    textDecoration: 'none',
                  }}
                >
                  → {rid}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <Card
      style={{
        padding: '10px 14px',
        marginBottom: 14,
        borderColor: 'var(--warn)',
        background: 'var(--warn-bg)',
      }}
    >
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--warn)' }}>{msg}</div>
    </Card>
  );
}

function formatEvent(e: PipelineEvent): string {
  if (e.type === 'log') return e.msg;
  if (e.type === 'item') return `  ✓ ${e.r}${e.title ? ` · ${e.title}` : ''}`;
  if (e.type === 'pair') return `  → pair ${e.r}`;
  if (e.type === 'map') return `  → ${e.r}: A=${e.mapping.A}, B=${e.mapping.B}`;
  if (e.type === 'pick') return `  → ${e.r} pick=${e.pick}`;
  if (e.type === 'complete') return `✓ complete · ${e.round_id}`;
  if (e.type === 'error') return `✗ error · ${e.msg}`;
  return JSON.stringify(e);
}

function colorFor(e: PipelineEvent): string {
  if (e.type === 'log') {
    return (
      {
        dim: '#7a7458',
        norm: '#d4cdb8',
        cyan: '#7dc4d4',
        green: '#a6d189',
        yellow: '#e5c890',
        red: '#e78284',
      }[e.level] || '#d4cdb8'
    );
  }
  if (e.type === 'error') return '#e78284';
  if (e.type === 'complete') return '#a6d189';
  if (e.type === 'pick' || e.type === 'item') return '#a6d189';
  return '#d4cdb8';
}
