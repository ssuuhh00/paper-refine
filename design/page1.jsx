// Page 1: Dashboard — KPIs + filters + round cards.

const { useState: useState1 } = React;

function Page1Dashboard() {
  const [filterPersona, setFilterPersona] = useState1('all');
  const [filterDecision, setFilterDecision] = useState1('all');
  const PERSONAS = window.PAPER_DATA.PERSONAS;
  const rounds = window.PAPER_DATA.ROUNDS_ALL;

  // KPIs aggregated
  const totalRounds = rounds.length;
  let totalR = 0, totalApply = 0, totalDecided = 0, totalRecModified = 0;
  rounds.forEach(r => {
    if (r.items) {
      totalR += r.items.length;
      r.items.forEach(it => {
        if (it.decision !== 'pending') totalDecided++;
        if (it.decision === 'apply') totalApply++;
        if (it.blind[it.verdict.pick] === 'modified') totalRecModified++;
      });
    } else {
      totalR += r.itemCount;
      totalApply += r.decisions.apply;
      totalDecided += r.decisions.apply + r.decisions.skip + r.decisions.reject;
      totalRecModified += r.recommendation.modified;
    }
  });
  const userApplyRate = Math.round(totalApply / totalR * 100);
  const recAdoptRate = Math.round(totalRecModified / totalR * 100);

  // Persona mini chart counts
  const personaCounts = { ieee: 0, outsider: 0, writing: 0, structure: 0 };
  rounds.forEach(r => { personaCounts[r.persona] = (personaCounts[r.persona] || 0) + (r.items?.length || r.itemCount); });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--sans)', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, background: 'var(--surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 22, height: 22, background: 'var(--ink)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg)', fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }}>R</div>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>paper-refine</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', padding: '2px 6px', background: 'var(--surface-2)', borderRadius: 3 }}>IEEE Access · ko</div>
        </div>
        <div style={{ flex: 1 }} />
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 13px', background: 'var(--accent)', color: 'var(--accent-fg)',
          border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
        }}>+ Run new round</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '24px 28px' }}>
          <div style={{ marginBottom: 22 }}>
            <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.4, margin: 0, marginBottom: 4 }}>라운드 인덱스</h1>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>고도화 파이프라인의 누적 결과 · {totalRounds} rounds · {totalR} R-items</p>
          </div>

          {/* KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 22 }}>
            <Kpi label="총 라운드" value={totalRounds} unit="rounds" />
            <Kpi label="총 R항목" value={totalR} unit="items" />
            <Kpi label="추천 채택률" value={recAdoptRate + '%'} desc={`Discriminator → modified ${totalRecModified}/${totalR}`} />
            <Kpi label="사용자 적용률" value={userApplyRate + '%'} desc={`apply ${totalApply}/${totalR}`} accent />
          </div>

          {/* Persona mini chart */}
          <Card style={{ padding: 16, marginBottom: 22 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 }}>페르소나별 R항목 분포</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {Object.entries(PERSONAS).map(([k, p]) => {
                const v = personaCounts[k] || 0;
                const max = Math.max(...Object.values(personaCounts), 1);
                return (
                  <div key={k} style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, fontFamily: 'var(--mono)' }}>
                      <span style={{ color: 'var(--ink-2)' }}>{p.short}</span>
                      <span style={{ color: 'var(--ink-3)' }}>{v}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${v / max * 100}%`, background: `oklch(0.55 0.13 ${p.hue})`, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 18 }}>
            {/* Filters sidebar */}
            <aside>
              <FilterGroup label="페르소나">
                <FilterPill k="all" cur={filterPersona} setCur={setFilterPersona}>전체</FilterPill>
                {Object.entries(PERSONAS).map(([k, p]) => (
                  <FilterPill key={k} k={k} cur={filterPersona} setCur={setFilterPersona} hue={p.hue}>{p.short}</FilterPill>
                ))}
              </FilterGroup>
              <FilterGroup label="결정 상태">
                {[
                  { k: 'all', label: '전체' },
                  { k: 'pending', label: '미결정 있음' },
                  { k: 'completed', label: '완료' },
                ].map(f => <FilterPill key={f.k} k={f.k} cur={filterDecision} setCur={setFilterDecision}>{f.label}</FilterPill>)}
              </FilterGroup>
              <FilterGroup label="섹션">
                {window.PAPER_DATA.SECTIONS.map(s => (
                  <FilterPill key={s.id} k={s.id} cur="x" setCur={() => {}}>{s.short}</FilterPill>
                ))}
              </FilterGroup>
            </aside>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {rounds.map(r => <RoundCard key={r.id} round={r} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, unit, desc, accent }) {
  return (
    <Card style={{ padding: 14, position: 'relative', overflow: 'hidden' }}>
      {accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'var(--accent)' }} />}
      <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
        <span style={{ fontSize: 26, fontWeight: 600, fontFamily: 'var(--mono)', letterSpacing: -0.5, color: accent ? 'var(--accent)' : 'var(--ink)' }}>{value}</span>
        {unit && <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{unit}</span>}
      </div>
      {desc && <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 4, fontFamily: 'var(--mono)' }}>{desc}</div>}
    </Card>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, color: 'var(--ink-3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</div>
    </div>
  );
}

function FilterPill({ k, cur, setCur, children, hue }) {
  const sel = cur === k;
  return (
    <button onClick={() => setCur(k)} style={{
      padding: '5px 9px', textAlign: 'left',
      border: '1px solid ' + (sel ? 'var(--ink)' : 'transparent'),
      background: sel ? 'var(--surface-2)' : 'transparent',
      color: sel ? 'var(--ink)' : 'var(--ink-2)',
      borderRadius: 4, fontSize: 11.5, fontFamily: 'var(--mono)', cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {hue !== undefined && <span style={{ width: 6, height: 6, borderRadius: 3, background: `oklch(0.55 0.15 ${hue})` }} />}
      {children}
    </button>
  );
}

function RoundCard({ round }) {
  const counts = round.items ? round.items.reduce((a, i) => { a[i.decision] = (a[i.decision] || 0) + 1; return a; }, { apply: 0, skip: 0, reject: 0, pending: 0 }) : { ...round.decisions, pending: 0 };
  const total = round.items ? round.items.length : round.itemCount;
  const recModified = round.items ? round.items.filter(i => i.blind[i.verdict.pick] === 'modified').length : round.recommendation.modified;
  const recOriginal = total - recModified;

  return (
    <Card style={{ padding: 14, cursor: 'pointer', transition: 'border 0.12s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--ink)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{round.ts}</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{round.display}</div>
        </div>
        <DecisionDonut counts={counts} size={42} />
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <PersonaBadge id={round.persona} size="sm" />
        <SectionTag id={round.section} />
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', padding: '2px 6px', background: 'var(--surface-2)', borderRadius: 3 }}>
          {round.model}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>R항목 {total}</span>
        <div style={{ flex: 1, height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden', display: 'flex' }}>
          <div style={{ width: `${recModified / total * 100}%`, background: 'var(--accent)', height: '100%' }} title={`modified ${recModified}`} />
          <div style={{ width: `${recOriginal / total * 100}%`, background: 'var(--ink-4)', height: '100%' }} title={`original ${recOriginal}`} />
        </div>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>{recModified}m / {recOriginal}o</span>
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { k: 'apply', c: 'var(--ok)' }, { k: 'skip', c: 'var(--mute)' },
          { k: 'reject', c: 'var(--warn)' }, { k: 'pending', c: 'var(--ink-4)' }
        ].map(s => counts[s.k] ? (
          <span key={s.k} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--mono)', fontSize: 10, color: s.c,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 3, background: s.c }} />
            {s.k} {counts[s.k]}
          </span>
        ) : null)}
      </div>
    </Card>
  );
}

Object.assign(window, { Page1Dashboard });
