// Shared components: badges, stamps, donut, stepper, diff viewer, etc.

const { useState, useEffect, useRef, useMemo } = React;

// ─── Persona badge (4 colors) ─────────────────────────────
function PersonaBadge({ id, size = 'md' }) {
  const p = window.PAPER_DATA.PERSONAS[id];
  if (!p) return null;
  const isSm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: isSm ? '2px 7px' : '3px 9px',
      borderRadius: 999,
      background: `oklch(0.96 0.02 ${p.hue})`,
      color: `oklch(0.42 0.12 ${p.hue})`,
      fontSize: isSm ? 10 : 11,
      fontWeight: 500,
      letterSpacing: 0.2,
      fontFamily: 'var(--mono)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: 5, background: `oklch(0.55 0.15 ${p.hue})` }} />
      {p.short}
    </span>
  );
}

// ─── Section tag ──────────────────────────────────────────
function SectionTag({ id, full = false }) {
  const sec = window.PAPER_DATA.SECTIONS.find(s => s.id === id);
  if (!sec) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px',
      borderRadius: 4,
      background: 'var(--surface-2)',
      color: 'var(--ink-2)',
      fontSize: 10.5,
      fontFamily: 'var(--mono)',
      whiteSpace: 'nowrap',
    }}>
      §{full ? sec.id : sec.short}
    </span>
  );
}

// ─── Decision stamp ───────────────────────────────────────
function DecisionStamp({ state, size = 'md' }) {
  const map = {
    apply:   { label: 'APPLY',   color: 'var(--ok)',     bg: 'var(--ok-bg)' },
    skip:    { label: 'SKIP',    color: 'var(--mute)',   bg: 'var(--mute-bg)' },
    reject:  { label: 'REJECT',  color: 'var(--warn)',   bg: 'var(--warn-bg)' },
    pending: { label: 'PENDING', color: 'var(--ink-3)',  bg: 'transparent' },
  };
  const s = map[state] || map.pending;
  const isPending = state === 'pending';
  const isSm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: isSm ? '1px 6px' : '2px 8px',
      borderRadius: 3,
      background: s.bg,
      color: s.color,
      fontSize: isSm ? 9.5 : 10.5,
      fontWeight: 600,
      letterSpacing: 0.6,
      fontFamily: 'var(--mono)',
      border: isPending ? '1px dashed var(--border)' : '1px solid transparent',
    }}>{s.label}</span>
  );
}

// ─── Decision donut ───────────────────────────────────────
function DecisionDonut({ counts, size = 36 }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const r = size / 2 - 3;
  const cx = size / 2, cy = size / 2;
  const C = 2 * Math.PI * r;
  const order = [
    { k: 'apply',   c: 'var(--ok)' },
    { k: 'skip',    c: 'var(--mute)' },
    { k: 'reject',  c: 'var(--warn)' },
    { k: 'pending', c: 'var(--ink-4)' },
  ];
  let off = 0;
  const applyPct = Math.round(((counts.apply || 0) / total) * 100);
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={3} />
        {order.map(o => {
          const v = counts[o.k] || 0;
          if (!v) return null;
          const len = (v / total) * C;
          const el = (
            <circle key={o.k} cx={cx} cy={cy} r={r} fill="none"
              stroke={o.c} strokeWidth={3}
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-off} />
          );
          off += len;
          return el;
        })}
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontSize: size > 50 ? 11 : 9, fontFamily: 'var(--mono)',
        color: 'var(--ink-2)', fontWeight: 600,
      }}>{applyPct}%</div>
    </div>
  );
}

// ─── 4-step progress stepper ──────────────────────────────
const STEPS = [
  { k: 'review',  label: 'Review',  ko: '리뷰' },
  { k: 'changes', label: 'Changes', ko: '수정안' },
  { k: 'blind',   label: 'Blind',   ko: '블라인드' },
  { k: 'verdict', label: 'Verdict', ko: '판정' },
];

function Stepper({ active, onPick, compact = false }) {
  const idx = STEPS.findIndex(s => s.k === active);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {STEPS.map((s, i) => {
        const isActive = i === idx;
        const isPast = i < idx;
        return (
          <React.Fragment key={s.k}>
            <button onClick={() => onPick && onPick(s.k)} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: compact ? '4px 10px' : '6px 12px',
              border: 'none',
              background: isActive ? 'var(--ink)' : 'transparent',
              color: isActive ? 'var(--bg)' : (isPast ? 'var(--ink)' : 'var(--ink-3)'),
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'var(--mono)',
              cursor: 'pointer',
              fontWeight: isActive ? 600 : 500,
              letterSpacing: 0.2,
            }}>
              <span style={{
                width: 16, height: 16, borderRadius: 8,
                background: isActive ? 'var(--bg)' : (isPast ? 'var(--ink)' : 'var(--surface-2)'),
                color: isActive ? 'var(--ink)' : (isPast ? 'var(--bg)' : 'var(--ink-3)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9.5, fontWeight: 700,
              }}>{isPast ? '✓' : i + 1}</span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <div style={{ width: 14, height: 1, background: 'var(--border)' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── LaTeX diff viewer ────────────────────────────────────
// Simple line-based diff with word-level highlighting on changed lines.

function lineDiff(aText, bText) {
  const a = aText.split('\n'), b = bText.split('\n');
  // LCS
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, () => new Array(n+1).fill(0));
  for (let i = m-1; i >= 0; i--) for (let j = n-1; j >= 0; j--) {
    dp[i][j] = a[i] === b[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
  }
  const out = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push({ t: 'eq', a: a[i], b: b[j] }); i++; j++; }
    else if (dp[i+1][j] >= dp[i][j+1]) { out.push({ t: 'del', a: a[i] }); i++; }
    else { out.push({ t: 'add', b: b[j] }); j++; }
  }
  while (i < m) { out.push({ t: 'del', a: a[i++] }); }
  while (j < n) { out.push({ t: 'add', b: b[j++] }); }
  // Pair adjacent del/add as "mod"
  const paired = [];
  for (let k = 0; k < out.length; k++) {
    if (out[k].t === 'del' && out[k+1] && out[k+1].t === 'add') {
      paired.push({ t: 'mod', a: out[k].a, b: out[k+1].b });
      k++;
    } else paired.push(out[k]);
  }
  return paired;
}

function tokenizeLatex(s) {
  // Split keeping spaces and LaTeX commands together.
  return s.split(/(\s+|\\[a-zA-Z]+\*?|[{}\[\]()=,])/g).filter(x => x !== undefined);
}

function wordDiff(aLine, bLine) {
  const a = tokenizeLatex(aLine), b = tokenizeLatex(bLine);
  const m = a.length, n = b.length;
  const dp = Array.from({length: m+1}, () => new Array(n+1).fill(0));
  for (let i = m-1; i >= 0; i--) for (let j = n-1; j >= 0; j--) {
    dp[i][j] = a[i] === b[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
  }
  const aOut = [], bOut = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { aOut.push({ t: 'eq', s: a[i] }); bOut.push({ t: 'eq', s: b[j] }); i++; j++; }
    else if (dp[i+1][j] >= dp[i][j+1]) { aOut.push({ t: 'del', s: a[i] }); i++; }
    else { bOut.push({ t: 'add', s: b[j] }); j++; }
  }
  while (i < m) aOut.push({ t: 'del', s: a[i++] });
  while (j < n) bOut.push({ t: 'add', s: b[j++] });
  return { a: aOut, b: bOut };
}

function renderTokens(tokens, side) {
  return tokens.map((t, i) => {
    if (t.t === 'eq') return <span key={i}>{t.s}</span>;
    if (t.t === 'del') return <span key={i} style={{ background: 'var(--del-bg)', color: 'var(--del)', borderRadius: 2, padding: '0 1px' }}>{t.s}</span>;
    if (t.t === 'add') return <span key={i} style={{ background: 'var(--add-bg)', color: 'var(--add)', borderRadius: 2, padding: '0 1px' }}>{t.s}</span>;
    return null;
  });
}

function DiffViewer({ original, modified, mode = 'split' }) {
  const diff = useMemo(() => lineDiff(original, modified), [original, modified]);
  // assign line numbers
  let aLn = 0, bLn = 0;
  const rows = diff.map(row => {
    if (row.t === 'eq')  { aLn++; bLn++; return { ...row, an: aLn, bn: bLn }; }
    if (row.t === 'del') { aLn++; return { ...row, an: aLn, bn: null }; }
    if (row.t === 'add') { bLn++; return { ...row, an: null, bn: bLn }; }
    if (row.t === 'mod') { aLn++; bLn++; return { ...row, an: aLn, bn: bLn }; }
    return row;
  });

  const lnStyle = { width: 28, textAlign: 'right', paddingRight: 8, color: 'var(--ink-4)', userSelect: 'none', fontVariantNumeric: 'tabular-nums', flexShrink: 0 };
  const codeBase = { fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1 };

  if (mode === 'unified') {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 0', overflow: 'hidden' }}>
        {rows.map((r, i) => {
          if (r.t === 'eq') return (
            <div key={i} style={{ display: 'flex', padding: '0 12px' }}>
              <div style={lnStyle}>{r.an}</div>
              <div style={lnStyle}>{r.bn}</div>
              <div style={codeBase}>{r.a || ' '}</div>
            </div>
          );
          if (r.t === 'del') return (
            <div key={i} style={{ display: 'flex', padding: '0 12px', background: 'var(--del-bg)' }}>
              <div style={lnStyle}>{r.an}</div>
              <div style={lnStyle}></div>
              <div style={{ ...codeBase, color: 'var(--del)' }}>− {r.a}</div>
            </div>
          );
          if (r.t === 'add') return (
            <div key={i} style={{ display: 'flex', padding: '0 12px', background: 'var(--add-bg)' }}>
              <div style={lnStyle}></div>
              <div style={lnStyle}>{r.bn}</div>
              <div style={{ ...codeBase, color: 'var(--add)' }}>+ {r.b}</div>
            </div>
          );
          if (r.t === 'mod') {
            const w = wordDiff(r.a, r.b);
            return (
              <React.Fragment key={i}>
                <div style={{ display: 'flex', padding: '0 12px', background: 'var(--del-bg)' }}>
                  <div style={lnStyle}>{r.an}</div>
                  <div style={lnStyle}></div>
                  <div style={{ ...codeBase, color: 'var(--del)' }}>− {renderTokens(w.a)}</div>
                </div>
                <div style={{ display: 'flex', padding: '0 12px', background: 'var(--add-bg)' }}>
                  <div style={lnStyle}></div>
                  <div style={lnStyle}>{r.bn}</div>
                  <div style={{ ...codeBase, color: 'var(--add)' }}>+ {renderTokens(w.b)}</div>
                </div>
              </React.Fragment>
            );
          }
          return null;
        })}
      </div>
    );
  }

  // split mode
  const Side = ({ kind }) => (
    <div style={{ flex: 1, minWidth: 0, background: 'var(--surface)' }}>
      <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: 0.5, display: 'flex', justifyContent: 'space-between' }}>
        <span>{kind === 'a' ? 'ORIGINAL' : 'MODIFIED'}</span>
        <span>{kind === 'a' ? `${original.split('\n').length} lines` : `${modified.split('\n').length} lines`}</span>
      </div>
      <div style={{ padding: '8px 0' }}>
        {rows.map((r, i) => {
          if (r.t === 'eq') return (
            <div key={i} style={{ display: 'flex', padding: '0 12px' }}>
              <div style={lnStyle}>{kind === 'a' ? r.an : r.bn}</div>
              <div style={codeBase}>{(kind === 'a' ? r.a : r.b) || ' '}</div>
            </div>
          );
          if (r.t === 'del') return (
            <div key={i} style={{ display: 'flex', padding: '0 12px', background: kind === 'a' ? 'var(--del-bg)' : 'var(--gutter)' }}>
              <div style={lnStyle}>{kind === 'a' ? r.an : ''}</div>
              <div style={{ ...codeBase, color: kind === 'a' ? 'var(--del)' : 'transparent' }}>{kind === 'a' ? r.a : ' '}</div>
            </div>
          );
          if (r.t === 'add') return (
            <div key={i} style={{ display: 'flex', padding: '0 12px', background: kind === 'b' ? 'var(--add-bg)' : 'var(--gutter)' }}>
              <div style={lnStyle}>{kind === 'b' ? r.bn : ''}</div>
              <div style={{ ...codeBase, color: kind === 'b' ? 'var(--add)' : 'transparent' }}>{kind === 'b' ? r.b : ' '}</div>
            </div>
          );
          if (r.t === 'mod') {
            const w = wordDiff(r.a, r.b);
            return (
              <div key={i} style={{ display: 'flex', padding: '0 12px', background: kind === 'a' ? 'var(--del-bg)' : 'var(--add-bg)' }}>
                <div style={lnStyle}>{kind === 'a' ? r.an : r.bn}</div>
                <div style={{ ...codeBase, color: kind === 'a' ? 'var(--del)' : 'var(--add)' }}>
                  {renderTokens(kind === 'a' ? w.a : w.b)}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
      <Side kind="a" />
      <div style={{ width: 1, background: 'var(--border)' }} />
      <Side kind="b" />
    </div>
  );
}

// ─── KBD ──────────────────────────────────────────────────
function Kbd({ children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 18, height: 18,
      padding: '0 5px',
      borderRadius: 3,
      background: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderBottomWidth: 2,
      color: 'var(--ink-2)',
      fontSize: 10,
      fontFamily: 'var(--mono)',
      fontWeight: 600,
    }}>{children}</span>
  );
}

// ─── Card chrome ──────────────────────────────────────────
function Card({ children, style, ...rest }) {
  return (
    <div {...rest} style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      ...style,
    }}>{children}</div>
  );
}

Object.assign(window, {
  PersonaBadge, SectionTag, DecisionStamp, DecisionDonut,
  Stepper, STEPS, DiffViewer, Kbd, Card,
});
