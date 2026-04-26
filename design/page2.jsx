// Page 2: Round launcher — form + in-place progress console.
//
// Two visual states:
//   1) form  — full launcher form
//   2) running / completed — form collapses into compact summary header,
//      progress panel takes the full canvas with detailed step cards
//      (each step shows live output, counters, timings).

const { useState: useState2, useEffect: useEffect2, useRef: useRef2 } = React;

function Page2Launcher({ initialState = 'form' }) {
  const [persona, setPersona] = useState2('ieee');
  const [sections, setSections] = useState2(['03_methodology.tex', '04_experiments.tex']);
  const [rounds, setRounds] = useState2(2);
  const [model, setModel] = useState2('sonnet');
  const [dryRun, setDryRun] = useState2(false);
  const [phase, setPhase] = useState2(initialState); // form | running | done

  const allSections = window.PAPER_DATA.SECTIONS;
  const PERSONAS = window.PAPER_DATA.PERSONAS;

  const toggleSection = (id) => {
    setSections(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };
  const allOn = sections.length === allSections.length;
  const toggleAll = () => setSections(allOn ? [] : allSections.map(s => s.id));

  const cmd = `./refine.sh --persona ${persona} --sections "${sections.length === allSections.length ? 'all' : sections.join(',')}" --rounds ${rounds} --model ${model}${dryRun ? ' --dry-run' : ''}`;

  if (phase === 'form') {
    return (
      <div style={page2Frame}>
        <TopBar />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 28px' }}>
            <Header />

            <Field label="페르소나" desc="Reviewer가 어떤 관점으로 지적할지 결정합니다.">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {Object.entries(PERSONAS).map(([k, p]) => {
                  const sel = persona === k;
                  return (
                    <button key={k} onClick={() => setPersona(k)} style={{
                      padding: '12px 14px', textAlign: 'left',
                      border: sel ? `1.5px solid oklch(0.55 0.15 ${p.hue})` : '1px solid var(--border)',
                      background: sel ? `oklch(0.97 0.02 ${p.hue})` : 'var(--surface)',
                      borderRadius: 7, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', gap: 4,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 8, background: `oklch(0.55 0.15 ${p.hue})` }} />
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>{p.short}</span>
                        <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{p.ko}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{p.desc}</div>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="섹션" desc="검토할 .tex 파일 (다중 선택)">
              <div style={{ marginBottom: 8 }}>
                <button onClick={toggleAll} style={{
                  padding: '4px 10px', border: '1px solid var(--border)',
                  background: allOn ? 'var(--ink)' : 'transparent',
                  color: allOn ? 'var(--bg)' : 'var(--ink-2)',
                  borderRadius: 4, fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer',
                }}>{allOn ? '✓ 전체' : '전체'}</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {allSections.map(s => {
                  const checked = sections.includes(s.id);
                  return (
                    <label key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px',
                      border: '1px solid var(--border)',
                      background: checked ? 'var(--surface-2)' : 'var(--surface)',
                      borderRadius: 5, cursor: 'pointer',
                    }}>
                      <span style={{
                        width: 14, height: 14, borderRadius: 3,
                        border: '1.5px solid ' + (checked ? 'var(--accent)' : 'var(--border)'),
                        background: checked ? 'var(--accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--accent-fg)', fontSize: 9,
                      }}>{checked ? '✓' : ''}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)' }}>{s.id}</span>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}>{s.short}</span>
                      <input type="checkbox" checked={checked} onChange={() => toggleSection(s.id)} style={{ display: 'none' }} />
                    </label>
                  );
                })}
              </div>
            </Field>

            <Field label="라운드 수" desc="동일 섹션을 반복 검토할 횟수">
              <Stepper2 value={rounds} min={1} max={10} onChange={setRounds} />
            </Field>

            <Field label="모델">
              <div style={{ display: 'flex', gap: 6 }}>
                {['haiku', 'sonnet', 'opus'].map(m => {
                  const sel = model === m;
                  return (
                    <button key={m} onClick={() => setModel(m)} style={{
                      flex: 1, padding: '8px 12px',
                      border: '1px solid ' + (sel ? 'var(--ink)' : 'var(--border)'),
                      background: sel ? 'var(--ink)' : 'var(--surface)',
                      color: sel ? 'var(--bg)' : 'var(--ink-2)',
                      borderRadius: 5, fontSize: 12, fontFamily: 'var(--mono)', cursor: 'pointer',
                      fontWeight: sel ? 600 : 500,
                    }}>{m}</button>
                  );
                })}
              </div>
            </Field>

            <Field>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', background: dryRun ? 'var(--surface-2)' : 'var(--surface)' }}>
                <span style={{
                  width: 32, height: 18, borderRadius: 9,
                  background: dryRun ? 'var(--accent)' : 'var(--border)',
                  position: 'relative', flexShrink: 0,
                  transition: 'background 0.15s',
                }}>
                  <span style={{
                    position: 'absolute', top: 2, left: dryRun ? 16 : 2,
                    width: 14, height: 14, borderRadius: 7,
                    background: '#fff',
                    transition: 'left 0.15s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
                  }} />
                </span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>Dry-run</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>실제 호출 없이 명령만 확인</div>
                </div>
                <input type="checkbox" checked={dryRun} onChange={() => setDryRun(!dryRun)} style={{ display: 'none' }} />
              </label>
            </Field>

            <Field label="예상 명령어">
              <pre style={{
                margin: 0, padding: '12px 14px',
                background: '#0e0d0a', color: '#d4cdb8',
                borderRadius: 6,
                fontFamily: 'var(--mono)', fontSize: 11.5, lineHeight: 1.6,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                border: '1px solid var(--border)',
              }}><span style={{ color: '#7a7458' }}>$ </span>{cmd}</pre>
            </Field>

            <button onClick={() => setPhase('running')} disabled={!sections.length} style={{
              width: '100%', padding: '14px 20px',
              background: !sections.length ? 'var(--surface-2)' : 'var(--accent)',
              color: !sections.length ? 'var(--ink-4)' : 'var(--accent-fg)',
              border: 'none', borderRadius: 7,
              fontSize: 14, fontWeight: 600,
              cursor: !sections.length ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--sans)', marginTop: 8,
            }}>{dryRun ? 'Dry-run 미리보기' : '▶ 실행'}</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Running / done state ──────────────────────────────
  return (
    <RunningView
      cfg={{ persona, sections, rounds, model, dryRun }}
      done={phase === 'done'}
      onBack={() => setPhase('form')}
      onComplete={() => setPhase('done')}
    />
  );
}

function TopBar() {
  return (
    <div style={{ borderBottom: '1px solid var(--border)', padding: '14px 24px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>← 라운드 인덱스</div>
      <div style={{ flex: 1 }} />
    </div>
  );
}

function Header() {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: 0.6, marginBottom: 6 }}>NEW ROUND</div>
      <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.5, margin: 0, marginBottom: 6 }}>라운드 실행</h1>
      <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, lineHeight: 1.55 }}>refine.sh를 호출해 새 라운드를 누적합니다. 진행 과정은 같은 화면에서 인플레이스로 노출됩니다.</p>
    </div>
  );
}

const page2Frame = {
  height: '100%', display: 'flex', flexDirection: 'column',
  background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--sans)',
};

function Field({ label, desc, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      {label && <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>}
      {desc && <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.5 }}>{desc}</div>}
      {children}
    </div>
  );
}

function Stepper2({ value, min, max, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: 5, width: 'fit-content', overflow: 'hidden', background: 'var(--surface)' }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} style={btnStyle2}>−</button>
      <div style={{ width: 60, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600 }}>{value}</div>
      <button onClick={() => onChange(Math.min(max, value + 1))} style={btnStyle2}>+</button>
    </div>
  );
}
const btnStyle2 = {
  width: 36, height: 32, border: 'none', background: 'transparent',
  color: 'var(--ink-2)', fontSize: 16, cursor: 'pointer', fontFamily: 'var(--mono)',
};

// ─────────────────────────────────────────────────────────
// Running view — completely different layout from the form.
// Compact summary header + 4 step cards (timeline) + live console.
// ─────────────────────────────────────────────────────────

const STAGES = [
  { k: 'review',  label: 'Reviewer',       desc: '페르소나로 지적사항 추출' },
  { k: 'changes', label: 'Generator',      desc: '원문/수정안 LaTeX 쌍 작성' },
  { k: 'blind',   label: 'Blind Shuffle',  desc: 'A/B 무작위 셔플 + mapping' },
  { k: 'verdict', label: 'Discriminator',  desc: '블라인드 판정 + 추천' },
];

const TIMELINE = [
  { stage: 'review',  c: 'dim',    t: '[21:14:02] starting refine.sh', meta: { ts: '21:14:02' } },
  { stage: 'review',  c: 'dim',    t: '[21:14:02] persona=ieee · 2 sections · 2 rounds · sonnet' },
  { stage: 'review',  c: 'dim',    t: '[21:14:03] loading 03_methodology.tex (412 lines)' },
  { stage: 'review',  c: 'norm',   t: '  → invoking persona=ieee on chunk 1/3' },
  { stage: 'review',  c: 'green',  t: '  ✓ R1 found · 표기 일관성 (Sec. 3.2 L.142)' },
  { stage: 'review',  c: 'green',  t: '  ✓ R2 found · 점근 표기 (Sec. 3.4 L.198)' },
  { stage: 'review',  c: 'green',  t: '  ✓ R3 found · 하이퍼파라미터 표 (Sec. 3.5 L.221)' },
  { stage: 'review',  c: 'green',  t: '  ✓ R4 found · 분할 비율 (Sec. 3.3 L.175)' },
  { stage: 'review',  c: 'norm',   t: '  → 8 R-items written to 1_review.md (3.1s)' },
  { stage: 'changes', c: 'cyan',   t: '── Step 2/4 — Generator ──────────────────', meta: { ts: '21:14:08' } },
  { stage: 'changes', c: 'norm',   t: '  → producing original/modified pairs (R1)' },
  { stage: 'changes', c: 'norm',   t: '  → producing original/modified pairs (R2)' },
  { stage: 'changes', c: 'norm',   t: '  → producing original/modified pairs (R3 · R4)' },
  { stage: 'changes', c: 'yellow', t: '  ⚠ R6: latex compile warning (algorithm overflow)' },
  { stage: 'changes', c: 'norm',   t: '  → 8 pairs written to 2_changes.md (12.4s)' },
  { stage: 'blind',   c: 'cyan',   t: '── Step 3/4 — Blind Shuffle ──────────────', meta: { ts: '21:14:21' } },
  { stage: 'blind',   c: 'norm',   t: '  → shuffling A/B mappings (seed=2026)' },
  { stage: 'blind',   c: 'norm',   t: '  → R1: A=modified, B=original' },
  { stage: 'blind',   c: 'norm',   t: '  → R2: A=original, B=modified' },
  { stage: 'blind',   c: 'norm',   t: '  → mapping written to 3_mapping.txt' },
  { stage: 'verdict', c: 'cyan',   t: '── Step 4/4 — Discriminator ──────────────', meta: { ts: '21:14:23' } },
  { stage: 'verdict', c: 'norm',   t: '  → judging R1 → pick=A (modified)' },
  { stage: 'verdict', c: 'norm',   t: '  → judging R2 → pick=B (modified)' },
  { stage: 'verdict', c: 'norm',   t: '  → judging R3 → pick=A (modified)' },
  { stage: 'verdict', c: 'norm',   t: '  → judging R4 → pick=A (modified)' },
  { stage: 'verdict', c: 'green',  t: '  ✓ 8/8 verdicts written to 4_verdict.md' },
  { stage: 'done',    c: 'cyan',   t: '──────────────────────────────────────────' },
  { stage: 'done',    c: 'green',  t: '✓ Round 003 complete · 8 R-items · 6 modified, 2 original (28.7s)' },
];

function RunningView({ cfg, done, onBack, onComplete }) {
  const [step, setStep] = useState2(0);
  const consoleRef = useRef2(null);
  const PERSONAS = window.PAPER_DATA.PERSONAS;

  useEffect2(() => {
    if (step >= TIMELINE.length) { onComplete && onComplete(); return; }
    const t = setTimeout(() => setStep(s => s + 1), 220);
    return () => clearTimeout(t);
  }, [step]);

  useEffect2(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [step]);

  const visible = TIMELINE.slice(0, step);
  const currentStage = visible.length ? visible[visible.length - 1].stage : 'review';
  const stageIdx = STAGES.findIndex(s => s.k === currentStage);
  const isDone = currentStage === 'done' || done;

  // per-stage stats
  const stageStats = {};
  STAGES.forEach((s, i) => {
    const lines = visible.filter(l => l.stage === s.k);
    const counters = {
      review:  /R\d+ found/g,
      changes: /pairs written|⚠/g,
      blind:   /A=|B=/g,
      verdict: /pick=/g,
    }[s.k];
    const matches = counters ? lines.flatMap(l => l.t.match(counters) || []) : [];
    let status = 'pending';
    if (i < stageIdx || isDone) status = 'done';
    else if (i === stageIdx) status = 'active';
    stageStats[s.k] = { count: matches.length, status, lines: lines.length };
  });

  const persona = PERSONAS[cfg.persona];
  const elapsed = Math.min(28.7, step * 0.22).toFixed(1);

  return (
    <div style={page2Frame}>
      <TopBar />

      {/* Compact summary header replaces the full form */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '14px 24px',
      }}>
        <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 10px',
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--ink-2)', borderRadius: 5,
            fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer',
          }}>← 폼 수정</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{
              width: 8, height: 8, borderRadius: 8,
              background: isDone ? 'var(--ok)' : 'var(--accent)',
              animation: isDone ? 'none' : 'pulse 1.4s infinite',
            }} />
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
              {isDone ? 'Round 003 · complete' : 'Round 003 · running'}
            </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
              {persona.short} · {cfg.sections.length} files · {cfg.model} · {elapsed}s
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {!isDone && <>
              <button style={navBtn2}>백그라운드</button>
              <button style={{ ...navBtn2, color: 'var(--warn)', borderColor: 'var(--warn)' }}>취소</button>
            </>}
            {isDone && <button style={{
              padding: '6px 14px', background: 'var(--ok)', color: 'var(--bg)',
              border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--sans)',
            }}>→ Round 003 결과 보기</button>}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 24px 40px' }}>

          {/* Stage cards — visualizes what each step is doing */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 18 }}>
            {STAGES.map((s, i) => {
              const stat = stageStats[s.k];
              const active = stat.status === 'active';
              const doneStg = stat.status === 'done';
              return (
                <div key={s.k} style={{
                  padding: '12px 14px',
                  background: 'var(--surface)',
                  border: '1px solid ' + (active ? 'var(--accent)' : 'var(--border)'),
                  borderRadius: 7,
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {active && <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                    background: 'var(--accent)',
                    animation: 'progressBar 1.4s ease-in-out infinite',
                  }} />}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: 4,
                      background: doneStg ? 'var(--ok)' : (active ? 'var(--accent)' : 'var(--surface-2)'),
                      color: doneStg || active ? 'var(--bg)' : 'var(--ink-3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                    }}>{doneStg ? '✓' : i + 1}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: 'var(--ink)' }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginBottom: 8, lineHeight: 1.4 }}>{s.desc}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600,
                      color: doneStg ? 'var(--ok)' : (active ? 'var(--accent)' : 'var(--ink-4)'),
                    }}>{stat.count}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                      {{ review: 'R-items', changes: 'pairs', blind: 'maps', verdict: 'picks' }[s.k]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall progress bar with stage markers */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: 0.5, textTransform: 'uppercase' }}>전체 진행</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums' }}>
                {Math.min(step, TIMELINE.length)} / {TIMELINE.length} events · {Math.round(Math.min(step, TIMELINE.length) / TIMELINE.length * 100)}%
              </span>
            </div>
            <div style={{ position: 'relative', height: 8, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, height: '100%',
                width: `${Math.min(step, TIMELINE.length) / TIMELINE.length * 100}%`,
                background: isDone ? 'var(--ok)' : 'var(--accent)',
                transition: 'width 0.3s',
              }} />
            </div>
          </div>

          {/* Live console */}
          <Card style={{ overflow: 'hidden', padding: 0 }}>
            <div style={{
              padding: '8px 14px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--surface)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: '#e85751' }} />
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: '#e9b22e' }} />
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: '#5db95d' }} />
                </span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>refine.sh · live output</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: 'var(--accent)' }} /> auto-scroll
                </label>
                <span>·</span>
                <span>{visible.length} lines</span>
              </div>
            </div>
            <div ref={consoleRef} style={{
              background: '#0e0d0a', color: '#d4cdb8',
              padding: '12px 14px',
              height: 280,
              overflowY: 'auto',
              fontFamily: 'var(--mono)', fontSize: 11.5, lineHeight: 1.6,
            }}>
              {visible.map((ln, i) => {
                const c = { dim: '#7a7458', norm: '#d4cdb8', cyan: '#7dc4d4', green: '#a6d189', yellow: '#e5c890', red: '#e78284' }[ln.c] || '#d4cdb8';
                return <div key={i} style={{ color: c, whiteSpace: 'pre-wrap' }}>{ln.t}</div>;
              })}
              {!isDone && <div style={{ color: '#a6d189', animation: 'blink 1s step-end infinite' }}>▎</div>}
            </div>
          </Card>

          {/* Output files appearing as the run progresses */}
          <div style={{ marginTop: 18 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>
              산출 파일 · 20260426_211402_round_003/
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
              {[
                { name: '1_review.md',     stage: 'review',  size: '6.2 KB' },
                { name: '2_changes.md',    stage: 'changes', size: '14.8 KB' },
                { name: '3_blind_test.md', stage: 'blind',   size: '12.1 KB' },
                { name: '3_mapping.txt',   stage: 'blind',   size: '184 B' },
                { name: '4_verdict.md',    stage: 'verdict', size: '8.4 KB' },
                { name: 'decisions.json',  stage: 'verdict', size: '— pending' },
              ].map(f => {
                const stgIdx = STAGES.findIndex(s => s.k === f.stage);
                const ready = stgIdx < stageIdx || isDone;
                return (
                  <div key={f.name} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 12px',
                    border: '1px solid var(--border)',
                    background: ready ? 'var(--surface)' : 'var(--surface-2)',
                    borderRadius: 5,
                    opacity: ready ? 1 : 0.5,
                  }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: ready ? 'var(--ok)' : 'var(--ink-4)' }}>
                      {ready ? '●' : '○'}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink)', flex: 1 }}>{f.name}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>{f.size}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes progressBar { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
      `}</style>
    </div>
  );
}
const navBtn2 = {
  padding: '5px 10px', border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--ink-2)', borderRadius: 4, fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer',
};

Object.assign(window, { Page2Launcher });
