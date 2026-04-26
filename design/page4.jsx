// Page 4: Error notes (오답노트) — accumulated rejection timeline.

function Page4ErrorNotes() {
  const notes = window.PAPER_DATA.ERROR_NOTES;
  const PERSONAS = window.PAPER_DATA.PERSONAS;

  return (
    <div style={{ height: '100%', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--sans)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>← 라운드 인덱스</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--warn)', letterSpacing: 0.6, marginBottom: 6 }}>ERROR NOTES</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4, margin: 0, marginBottom: 4 }}>오답노트</h1>
          <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>거부된 수정안의 사유 — Discriminator 거부 + 사용자 거부 누적</p>
        </div>

        {/* legend */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, fontFamily: 'var(--mono)', fontSize: 11 }}>
          <Legend color="var(--warn)" label="user — 사용자 거부" />
          <Legend color="var(--accent)" label="discriminator — AI 거부" />
        </div>

        <div style={{ position: 'relative', paddingLeft: 20 }}>
          <div style={{ position: 'absolute', left: 5, top: 8, bottom: 8, width: 1, background: 'var(--border)' }} />
          {notes.map((n, i) => {
            const isUser = n.source === 'user';
            const color = isUser ? 'var(--warn)' : 'var(--accent)';
            return (
              <div key={i} style={{ position: 'relative', marginBottom: 14, cursor: 'pointer' }}>
                <div style={{
                  position: 'absolute', left: -20, top: 12,
                  width: 11, height: 11, borderRadius: 6,
                  background: 'var(--bg)',
                  border: `2px solid ${color}`,
                }} />
                <Card style={{ padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                      color, padding: '2px 6px', background: isUser ? 'var(--warn-bg)' : 'var(--accent-bg)', borderRadius: 3,
                    }}>{n.source.toUpperCase()}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}>R{n.r.slice(1)}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>round {n.round}</span>
                    <SectionTag id={n.section} />
                    <PersonaBadge id={n.persona} size="sm" />
                    <span style={{ flex: 1 }} />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>{n.date}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 4, textWrap: 'pretty' }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55, textWrap: 'pretty' }}>{n.reason}</div>
                  <div style={{ marginTop: 8, fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--accent)' }}>→ 라운드 {n.round} R{n.r.slice(1)}로 이동</div>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Group view summary */}
        <Card style={{ padding: 14, marginTop: 22 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>페르소나별 거부 빈도</div>
          {Object.entries(PERSONAS).map(([k, p]) => {
            const cnt = notes.filter(n => n.persona === k).length;
            const max = 5;
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, width: 70, color: 'var(--ink-2)' }}>{p.short}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${cnt / max * 100}%`, background: `oklch(0.55 0.13 ${p.hue})` }} />
                </div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', width: 16, textAlign: 'right' }}>{cnt}</span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-3)' }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
      {label}
    </div>
  );
}

Object.assign(window, { Page4ErrorNotes });
