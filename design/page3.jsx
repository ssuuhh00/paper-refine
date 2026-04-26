// Page 3: Round detail workspace — the core decision-making screen.

const { useState: useState3, useEffect: useEffect3, useRef: useRef3 } = React;

function Page3Workspace({ density = 'comfortable', showKbdHints = true }) {
  const round = window.PAPER_DATA.ROUND_CURRENT;
  const [items, setItems] = useState3(round.items);
  const [activeR, setActiveR] = useState3('R4');  // pending one
  const [step, setStep] = useState3('verdict');
  const [diffMode, setDiffMode] = useState3('split');
  const [filter, setFilter] = useState3('all'); // all | pending | reject
  const [revealed, setRevealed] = useState3({});
  const [showApplyModal, setShowApplyModal] = useState3(false);

  const item = items.find(i => i.r === activeR) || items[0];
  const filteredItems = items.filter(i => {
    if (filter === 'pending') return i.decision === 'pending';
    if (filter === 'reject') return i.decision === 'reject';
    return true;
  });

  const decided = items.filter(i => i.decision !== 'pending').length;
  const counts = items.reduce((acc, i) => { acc[i.decision] = (acc[i.decision] || 0) + 1; return acc; }, { apply: 0, skip: 0, reject: 0, pending: 0 });
  const applyCount = counts.apply;

  const setDecision = (r, decision, extra = {}) => {
    setItems(prev => prev.map(i => i.r === r ? { ...i, decision, ...extra } : i));
  };

  const moveR = (delta) => {
    const idx = items.findIndex(i => i.r === activeR);
    const next = items[Math.max(0, Math.min(items.length - 1, idx + delta))];
    if (next) setActiveR(next.r);
  };

  // Keyboard shortcuts
  useEffect3(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'a' || e.key === 'A') setDecision(activeR, 'apply');
      else if (e.key === 's' || e.key === 'S') setDecision(activeR, 'skip');
      else if (e.key === 'r' || e.key === 'R') setDecision(activeR, 'reject');
      else if (e.key === 'ArrowLeft') moveR(-1);
      else if (e.key === 'ArrowRight') moveR(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeR, items]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--sans)' }}>
      {/* Top bar */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
          <span>← 라운드 인덱스</span>
          <span style={{ color: 'var(--ink-4)' }}>/</span>
          <span style={{ color: 'var(--ink)' }}>{round.id}</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PersonaBadge id={round.persona} />
          <SectionTag id={round.section} full />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{round.ts}</span>
        </div>
      </div>

      {/* Sub bar — title + stepper + apply CTA */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>{round.display}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2, fontFamily: 'var(--mono)' }}>
            {decided}/{items.length} 결정 · 적용 {counts.apply} · 보류 {counts.skip} · 거부 {counts.reject} · 미결정 {counts.pending}
          </div>
        </div>
        <Stepper active={step} onPick={setStep} compact />
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowApplyModal(true)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 14px',
          background: 'var(--accent)',
          color: 'var(--accent-fg)',
          border: 'none', borderRadius: 6,
          fontSize: 12, fontWeight: 600, fontFamily: 'var(--sans)',
          cursor: 'pointer',
        }}>
          <span>Apply selected to .tex</span>
          <span style={{ fontFamily: 'var(--mono)', opacity: 0.8 }}>{applyCount}</span>
        </button>
      </div>

      {/* Main: sidebar + content */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left sidebar — R items */}
        <aside style={{ width: 280, borderRight: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>R 항목 · {items.length}</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { k: 'all', label: '전체' },
                { k: 'pending', label: '미결정' },
                { k: 'reject', label: '거부' },
              ].map(f => (
                <button key={f.k} onClick={() => setFilter(f.k)} style={{
                  flex: 1, padding: '5px 8px',
                  border: '1px solid ' + (filter === f.k ? 'var(--ink)' : 'var(--border)'),
                  background: filter === f.k ? 'var(--ink)' : 'transparent',
                  color: filter === f.k ? 'var(--bg)' : 'var(--ink-2)',
                  borderRadius: 5, fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer',
                }}>{f.label}</button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {filteredItems.map(it => {
              const isActive = it.r === activeR;
              const recommendsModified = it.verdict.pick === Object.keys(it.blind).find(k => it.blind[k] === 'modified');
              return (
                <button key={it.r} onClick={() => setActiveR(it.r)} style={{
                  width: '100%', padding: '10px 14px',
                  background: isActive ? 'var(--surface-2)' : 'transparent',
                  border: 'none',
                  borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                  textAlign: 'left', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 4,
                  borderBottom: '1px solid var(--border-soft)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{it.r}</span>
                    <DecisionStamp state={it.decision} size="sm" />
                  </div>
                  <div style={{ fontSize: 12, color: isActive ? 'var(--ink)' : 'var(--ink-2)', lineHeight: 1.4, textWrap: 'pretty' }}>{it.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
                    <span>{recommendsModified ? '→ modified' : '→ original'}</span>
                    <span>·</span>
                    <span>pick {it.verdict.pick}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Content scroll area */}
        <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <div style={{ padding: density === 'compact' ? '20px 28px 140px' : '28px 36px 160px', maxWidth: 1100, margin: '0 auto' }}>
            {/* Header of item */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{item.r}</span>
                <span>·</span>
                <span>{item.location}</span>
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4, margin: 0, lineHeight: 1.3, textWrap: 'balance' }}>{item.title}</h1>
            </div>

            {/* Step 1: Review */}
            <Section step="1" label="Review" ko="리뷰어 지적" active={step === 'review' || step === 'all'} onClick={() => setStep('review')}>
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>위치</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{item.location}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>인용</div>
                <blockquote style={{
                  margin: 0, padding: '10px 14px',
                  background: 'var(--surface-2)',
                  borderLeft: '3px solid var(--ink-4)',
                  fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.55,
                  color: 'var(--ink-2)', textWrap: 'pretty',
                }}>{item.cite}</blockquote>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>지적</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)', textWrap: 'pretty' }}>{item.issue}</div>
              </div>
            </Section>

            {/* Step 2: Changes */}
            <Section step="2" label="Changes" ko="원문 ↔ 수정안" onClick={() => setStep('changes')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                {['split', 'unified'].map(m => (
                  <button key={m} onClick={() => setDiffMode(m)} style={{
                    padding: '4px 10px',
                    border: '1px solid ' + (diffMode === m ? 'var(--ink)' : 'var(--border)'),
                    background: diffMode === m ? 'var(--ink)' : 'transparent',
                    color: diffMode === m ? 'var(--bg)' : 'var(--ink-2)',
                    borderRadius: 4, fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer',
                  }}>{m}</button>
                ))}
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--del-bg)', borderRadius: 2, marginRight: 5, verticalAlign: 'middle' }} />removed</span>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--add-bg)', borderRadius: 2, marginRight: 5, verticalAlign: 'middle' }} />added</span>
                </div>
              </div>
              <DiffViewer original={item.original} modified={item.modified} mode={diffMode} />
              <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 6, fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 }}>수정 근거</div>
                {item.rationale}
              </div>
            </Section>

            {/* Step 3: Blind test */}
            <Section step="3" label="Blind Test" ko="A/B 블라인드 비교 (Discriminator 입력)" onClick={() => setStep('blind')}>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.5 }}>
                Generator가 만든 원문/수정안을 무작위 셔플하여 Discriminator에 제시한 입력입니다. 정체는 mapping 공개 시 드러납니다.
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {['A', 'B'].map(side => {
                  const text = item.blind[side] === 'modified' ? item.modified : item.original;
                  const isRevealed = revealed[item.r];
                  const isPicked = item.verdict.pick === side;
                  return (
                    <Card key={side} style={{ padding: 0, overflow: 'hidden', borderColor: isPicked && isRevealed ? 'var(--ok)' : 'var(--border)' }}>
                      <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: 4,
                            background: isPicked && isRevealed ? 'var(--ok)' : 'var(--ink)',
                            color: 'var(--bg)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700,
                          }}>{side}</span>
                          {isRevealed && (
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
                              {item.blind[side]}
                            </span>
                          )}
                        </div>
                        {isPicked && isRevealed && (
                          <span style={{
                            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                            color: 'var(--ok)', padding: '2px 6px', background: 'var(--ok-bg)', borderRadius: 3,
                          }}>DISC. PICK</span>
                        )}
                      </div>
                      <pre style={{
                        margin: 0, padding: '12px 14px',
                        fontFamily: 'var(--mono)', fontSize: 11.5, lineHeight: 1.55,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        color: 'var(--ink-2)',
                        maxHeight: 240, overflowY: 'auto',
                      }}>{text}</pre>
                    </Card>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setRevealed(p => ({ ...p, [item.r]: !p[item.r] }))} style={{
                  padding: '5px 12px',
                  border: '1px solid var(--border)',
                  background: revealed[item.r] ? 'var(--surface-2)' : 'transparent',
                  color: 'var(--ink-2)',
                  borderRadius: 5, fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer',
                }}>{revealed[item.r] ? '↓ Hide mapping' : '→ Reveal mapping'}</button>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-4)' }}>
                  3_mapping.txt → R{item.r.slice(1)}: A={item.blind.A}, B={item.blind.B}
                </span>
              </div>
            </Section>

            {/* Step 4: Verdict */}
            <Section step="4" label="Verdict" ko="Discriminator 판정 + 추천 결과" onClick={() => setStep('verdict')}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
                <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minWidth: 120, background: 'var(--ok-bg)', borderColor: 'var(--ok)' }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ok)', letterSpacing: 0.6, marginBottom: 4 }}>PICK</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 42, fontWeight: 700, color: 'var(--ok)', lineHeight: 1 }}>{item.verdict.pick}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ok)', marginTop: 6 }}>
                    {item.blind[item.verdict.pick]}
                  </div>
                </Card>
                <Card style={{ flex: 1, padding: 14 }}>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: 0.5, marginBottom: 4 }}>선택 사유</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink)', marginBottom: 12, textWrap: 'pretty' }}>{item.verdict.reason}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: 0.5, marginBottom: 4 }}>탈락 사유</div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-2)', textWrap: 'pretty' }}>{item.verdict.loserReason}</div>
                </Card>
              </div>
              <div style={{
                marginTop: 12, padding: '10px 14px',
                background: 'var(--accent-bg)',
                borderRadius: 6,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--accent)', letterSpacing: 0.6, fontWeight: 700 }}>최종 추천</span>
                <span style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
                  {item.blind[item.verdict.pick] === 'modified' ? '수정안 채택' : '원문 유지'}
                </span>
              </div>
            </Section>

            <div style={{ height: 60 }} />
          </div>

          {/* Sticky decision bar */}
          <DecisionBar
            item={item}
            showKbdHints={showKbdHints}
            onDecide={(d, extra) => setDecision(item.r, d, extra)}
            onPrev={() => moveR(-1)}
            onNext={() => moveR(1)}
          />
        </main>
      </div>

      {showApplyModal && <ApplyModal items={items} round={round} onClose={() => setShowApplyModal(false)} />}
    </div>
  );
}

function Section({ step, label, ko, children }) {
  return (
    <section style={{ marginBottom: 28 }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
        <span style={{
          fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
          color: 'var(--bg)', background: 'var(--ink)',
          padding: '2px 7px', borderRadius: 3, letterSpacing: 0.5,
        }}>STEP {step}</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{ko}</span>
      </header>
      {children}
    </section>
  );
}

function DecisionBar({ item, showKbdHints, onDecide, onPrev, onNext }) {
  const [memo, setMemo] = useState3(item.memo || '');
  const [rejectReason, setRejectReason] = useState3(item.rejectReason || '');

  useEffect3(() => {
    setMemo(item.memo || '');
    setRejectReason(item.rejectReason || '');
  }, [item.r]);

  const opt = (k, label, ko, color, bg, fg) => (
    <button onClick={() => onDecide(k, k === 'reject' ? { rejectReason } : {})} style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
      padding: '10px 14px',
      border: item.decision === k ? `2px solid ${color}` : '1px solid var(--border)',
      background: item.decision === k ? bg : 'var(--surface)',
      color: item.decision === k ? fg : 'var(--ink-2)',
      borderRadius: 6, cursor: 'pointer',
      transition: 'all 0.12s',
      gap: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: item.decision === k ? color : 'var(--ink)' }}>{label}</span>
        {showKbdHints && <span style={{ marginLeft: 'auto' }}><Kbd>{k[0].toUpperCase()}</Kbd></span>}
      </div>
      <span style={{ fontSize: 11, color: item.decision === k ? color : 'var(--ink-3)' }}>{ko}</span>
    </button>
  );

  return (
    <div style={{
      position: 'sticky', bottom: 0, left: 0, right: 0,
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      boxShadow: '0 -4px 16px rgba(0,0,0,0.04)',
      padding: '12px 24px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: 0.6, textTransform: 'uppercase' }}>최종 결정 · {item.r}</span>
          <span style={{ flex: 1 }} />
          <button onClick={onPrev} style={navBtnStyle}>{showKbdHints && <Kbd>←</Kbd>} 이전</button>
          <button onClick={onNext} style={navBtnStyle}>다음 {showKbdHints && <Kbd>→</Kbd>}</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {opt('apply',  'APPLY',  '수정안 채택',     'var(--ok)',   'var(--ok-bg)',   'var(--ok)')}
          {opt('skip',   'SKIP',   '결정 보류',        'var(--mute)', 'var(--mute-bg)', 'var(--mute)')}
          {opt('reject', 'REJECT', '원문 유지 + 사유',  'var(--warn)', 'var(--warn-bg)', 'var(--warn)')}
        </div>
        {item.decision === 'reject' && (
          <input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            onBlur={() => onDecide('reject', { rejectReason })}
            placeholder="거부 사유 — 오답노트로 누적됩니다"
            style={inputStyle}
          />
        )}
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          onBlur={() => onDecide(item.decision, { memo, rejectReason })}
          placeholder="메모 (선택)"
          style={{ ...inputStyle, marginTop: 6 }}
        />
      </div>
    </div>
  );
}

const navBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '5px 10px',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--ink-2)',
  borderRadius: 5, fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer',
};

const inputStyle = {
  width: '100%', marginTop: 8,
  padding: '7px 10px',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--ink)',
  borderRadius: 5,
  fontSize: 12,
  fontFamily: 'var(--sans)',
  outline: 'none',
};

function ApplyModal({ items, round, onClose }) {
  const applies = items.filter(i => i.decision === 'apply');
  const rejects = items.filter(i => i.decision === 'reject');
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: 'var(--bg)',
        borderRadius: 10,
        width: 'min(720px, 92vw)',
        maxHeight: '86vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Apply preview</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{round.section} · {applies.length}개 적용 · {rejects.length}개 오답노트로</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', color: 'var(--ink-3)', fontSize: 18, cursor: 'pointer', width: 28, height: 28 }}>×</button>
        </div>
        <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>적용 대상 ({applies.length})</div>
          {applies.map(it => (
            <div key={it.r} style={{ marginBottom: 10, padding: '10px 12px', border: '1px solid var(--border)', borderLeft: '3px solid var(--ok)', borderRadius: 4, background: 'var(--surface)' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>{it.r}</span>
                <span style={{ fontSize: 12, color: 'var(--ink)' }}>{it.title}</span>
                <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>{it.location}</span>
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
                <span style={{ color: 'var(--del)' }}>− {it.original.split('\n')[0].slice(0, 50)}…</span><br />
                <span style={{ color: 'var(--add)' }}>+ {it.modified.split('\n')[0].slice(0, 50)}…</span>
              </div>
            </div>
          ))}
          {rejects.length > 0 && (
            <>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: 0.5, textTransform: 'uppercase', margin: '14px 0 8px' }}>오답노트로 ({rejects.length})</div>
              {rejects.map(it => (
                <div key={it.r} style={{ marginBottom: 8, padding: '8px 12px', border: '1px solid var(--border)', borderLeft: '3px solid var(--warn)', borderRadius: 4, fontSize: 12 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--accent)', marginRight: 6 }}>{it.r}</span>
                  <span>{it.rejectReason || it.title}</span>
                </div>
              ))}
            </>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ ...navBtnStyle, padding: '7px 14px' }}>취소</button>
          <button style={{
            padding: '7px 14px', background: 'var(--accent)', color: 'var(--accent-fg)',
            border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{applies.length}개 .tex 반영 + {rejects.length}개 오답노트</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Page3Workspace });
