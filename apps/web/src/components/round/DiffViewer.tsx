import { useMemo } from 'react';

export type DiffMode = 'split' | 'unified';

type Row =
  | { t: 'eq'; a: string; b: string; an: number; bn: number }
  | { t: 'del'; a: string; an: number; bn: null }
  | { t: 'add'; b: string; an: null; bn: number }
  | { t: 'mod'; a: string; b: string; an: number; bn: number };

function lineDiff(aText: string, bText: string): Row[] {
  const a = aText.split('\n');
  const b = bText.split('\n');
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  const out: { t: 'eq' | 'del' | 'add'; a?: string; b?: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      out.push({ t: 'eq', a: a[i]!, b: b[j]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push({ t: 'del', a: a[i]! });
      i++;
    } else {
      out.push({ t: 'add', b: b[j]! });
      j++;
    }
  }
  while (i < m) out.push({ t: 'del', a: a[i++] });
  while (j < n) out.push({ t: 'add', b: b[j++] });
  // pair adjacent del/add as 'mod'
  const paired: { t: 'eq' | 'del' | 'add' | 'mod'; a?: string; b?: string }[] = [];
  for (let k = 0; k < out.length; k++) {
    if (out[k]!.t === 'del' && out[k + 1]?.t === 'add') {
      paired.push({ t: 'mod', a: out[k]!.a, b: out[k + 1]!.b });
      k++;
    } else paired.push(out[k]!);
  }
  // line numbers
  let aLn = 0;
  let bLn = 0;
  return paired.map((row): Row => {
    if (row.t === 'eq') {
      aLn++;
      bLn++;
      return { t: 'eq', a: row.a!, b: row.b!, an: aLn, bn: bLn };
    }
    if (row.t === 'del') {
      aLn++;
      return { t: 'del', a: row.a!, an: aLn, bn: null };
    }
    if (row.t === 'add') {
      bLn++;
      return { t: 'add', b: row.b!, an: null, bn: bLn };
    }
    aLn++;
    bLn++;
    return { t: 'mod', a: row.a!, b: row.b!, an: aLn, bn: bLn };
  });
}

function tokenizeLatex(s: string): string[] {
  return s.split(/(\s+|\\[a-zA-Z]+\*?|[{}[\]()=,])/g).filter((x) => x !== undefined && x !== '');
}

type Tok = { t: 'eq' | 'del' | 'add'; s: string };

function wordDiff(aLine: string, bLine: string): { a: Tok[]; b: Tok[] } {
  const a = tokenizeLatex(aLine);
  const b = tokenizeLatex(bLine);
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  const aOut: Tok[] = [];
  const bOut: Tok[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      aOut.push({ t: 'eq', s: a[i]! });
      bOut.push({ t: 'eq', s: b[j]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      aOut.push({ t: 'del', s: a[i]! });
      i++;
    } else {
      bOut.push({ t: 'add', s: b[j]! });
      j++;
    }
  }
  while (i < m) aOut.push({ t: 'del', s: a[i++]! });
  while (j < n) bOut.push({ t: 'add', s: b[j++]! });
  return { a: aOut, b: bOut };
}

function renderTokens(tokens: Tok[]) {
  return tokens.map((t, i) => {
    if (t.t === 'eq') return <span key={i}>{t.s}</span>;
    if (t.t === 'del')
      return (
        <span
          key={i}
          style={{
            background: 'var(--del-bg)',
            color: 'var(--del)',
            borderRadius: 2,
            padding: '0 1px',
          }}
        >
          {t.s}
        </span>
      );
    return (
      <span
        key={i}
        style={{
          background: 'var(--add-bg)',
          color: 'var(--add)',
          borderRadius: 2,
          padding: '0 1px',
        }}
      >
        {t.s}
      </span>
    );
  });
}

const lnStyle = {
  width: 28,
  textAlign: 'right' as const,
  paddingRight: 8,
  color: 'var(--ink-4)',
  userSelect: 'none' as const,
  fontVariantNumeric: 'tabular-nums' as const,
  flexShrink: 0,
};
const codeBase = {
  fontFamily: 'var(--mono)',
  fontSize: 12,
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-word' as const,
  flex: 1,
};

type Props = {
  original: string;
  modified: string;
  mode?: DiffMode;
};

export function DiffViewer({ original, modified, mode = 'split' }: Props) {
  const rows = useMemo(() => lineDiff(original, modified), [original, modified]);

  if (mode === 'unified') {
    return (
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '8px 0',
          overflow: 'hidden',
        }}
      >
        {rows.map((r, i) => {
          if (r.t === 'eq')
            return (
              <div key={i} style={{ display: 'flex', padding: '0 12px' }}>
                <div style={lnStyle}>{r.an}</div>
                <div style={lnStyle}>{r.bn}</div>
                <div style={codeBase}>{r.a || ' '}</div>
              </div>
            );
          if (r.t === 'del')
            return (
              <div key={i} style={{ display: 'flex', padding: '0 12px', background: 'var(--del-bg)' }}>
                <div style={lnStyle}>{r.an}</div>
                <div style={lnStyle}></div>
                <div style={{ ...codeBase, color: 'var(--del)' }}>− {r.a}</div>
              </div>
            );
          if (r.t === 'add')
            return (
              <div key={i} style={{ display: 'flex', padding: '0 12px', background: 'var(--add-bg)' }}>
                <div style={lnStyle}></div>
                <div style={lnStyle}>{r.bn}</div>
                <div style={{ ...codeBase, color: 'var(--add)' }}>+ {r.b}</div>
              </div>
            );
          const w = wordDiff(r.a, r.b);
          return (
            <div key={i}>
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
            </div>
          );
        })}
      </div>
    );
  }

  // split mode
  const Side = ({ kind }: { kind: 'a' | 'b' }) => (
    <div style={{ flex: 1, minWidth: 0, background: 'var(--surface)' }}>
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          fontFamily: 'var(--mono)',
          fontSize: 10.5,
          color: 'var(--ink-3)',
          letterSpacing: 0.5,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{kind === 'a' ? 'ORIGINAL' : 'MODIFIED'}</span>
        <span>
          {kind === 'a'
            ? `${original.split('\n').length} lines`
            : `${modified.split('\n').length} lines`}
        </span>
      </div>
      <div style={{ padding: '8px 0' }}>
        {rows.map((r, i) => {
          if (r.t === 'eq')
            return (
              <div key={i} style={{ display: 'flex', padding: '0 12px' }}>
                <div style={lnStyle}>{kind === 'a' ? r.an : r.bn}</div>
                <div style={codeBase}>{(kind === 'a' ? r.a : r.b) || ' '}</div>
              </div>
            );
          if (r.t === 'del')
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  padding: '0 12px',
                  background: kind === 'a' ? 'var(--del-bg)' : 'var(--gutter)',
                }}
              >
                <div style={lnStyle}>{kind === 'a' ? r.an : ''}</div>
                <div style={{ ...codeBase, color: kind === 'a' ? 'var(--del)' : 'transparent' }}>
                  {kind === 'a' ? r.a : ' '}
                </div>
              </div>
            );
          if (r.t === 'add')
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  padding: '0 12px',
                  background: kind === 'b' ? 'var(--add-bg)' : 'var(--gutter)',
                }}
              >
                <div style={lnStyle}>{kind === 'b' ? r.bn : ''}</div>
                <div style={{ ...codeBase, color: kind === 'b' ? 'var(--add)' : 'transparent' }}>
                  {kind === 'b' ? r.b : ' '}
                </div>
              </div>
            );
          const w = wordDiff(r.a, r.b);
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                padding: '0 12px',
                background: kind === 'a' ? 'var(--del-bg)' : 'var(--add-bg)',
              }}
            >
              <div style={lnStyle}>{kind === 'a' ? r.an : r.bn}</div>
              <div style={{ ...codeBase, color: kind === 'a' ? 'var(--del)' : 'var(--add)' }}>
                {renderTokens(kind === 'a' ? w.a : w.b)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: 'flex',
        border: '1px solid var(--border)',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      <Side kind="a" />
      <div style={{ width: 1, background: 'var(--border)' }} />
      <Side kind="b" />
    </div>
  );
}
