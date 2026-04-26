import { useMemo } from 'react';

export type DiffMode = 'split' | 'unified';

type Tok = { t: 'eq' | 'del' | 'add'; s: string };

type EqRow = { t: 'eq'; a: string; b: string; an: number; bn: number };
type ClusterLine = { text: string; tokens: Tok[]; n: number };
type ClusterRow = { t: 'cluster'; aLines: ClusterLine[]; bLines: ClusterLine[] };
type Row = EqRow | ClusterRow;

function tokenizeLatex(s: string): string[] {
  return s.split(/(\s+|\\[a-zA-Z]+\*?|[{}[\]()=,])/g).filter((x) => x !== undefined && x !== '');
}

/**
 * Token-level LCS across multiple lines on each side. Returns each side's
 * tokens grouped back by source line, so the renderer can show line-by-line
 * with word-level highlighting that survives line splits/merges.
 */
function multiLineWordDiff(aLines: string[], bLines: string[]): { a: Tok[][]; b: Tok[][] } {
  type Src = { s: string; lineIdx: number };
  const aSrc: Src[] = [];
  const bSrc: Src[] = [];
  aLines.forEach((line, i) => tokenizeLatex(line).forEach((t) => aSrc.push({ s: t, lineIdx: i })));
  bLines.forEach((line, i) => tokenizeLatex(line).forEach((t) => bSrc.push({ s: t, lineIdx: i })));

  const m = aSrc.length;
  const n = bSrc.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--) {
      dp[i]![j] =
        aSrc[i]!.s === bSrc[j]!.s
          ? dp[i + 1]![j + 1]! + 1
          : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }

  const aOut: { t: 'eq' | 'del'; s: string; lineIdx: number }[] = [];
  const bOut: { t: 'eq' | 'add'; s: string; lineIdx: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (aSrc[i]!.s === bSrc[j]!.s) {
      aOut.push({ t: 'eq', s: aSrc[i]!.s, lineIdx: aSrc[i]!.lineIdx });
      bOut.push({ t: 'eq', s: bSrc[j]!.s, lineIdx: bSrc[j]!.lineIdx });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      aOut.push({ t: 'del', s: aSrc[i]!.s, lineIdx: aSrc[i]!.lineIdx });
      i++;
    } else {
      bOut.push({ t: 'add', s: bSrc[j]!.s, lineIdx: bSrc[j]!.lineIdx });
      j++;
    }
  }
  while (i < m) {
    aOut.push({ t: 'del', s: aSrc[i]!.s, lineIdx: aSrc[i]!.lineIdx });
    i++;
  }
  while (j < n) {
    bOut.push({ t: 'add', s: bSrc[j]!.s, lineIdx: bSrc[j]!.lineIdx });
    j++;
  }

  const aByLine: Tok[][] = aLines.map(() => []);
  const bByLine: Tok[][] = bLines.map(() => []);
  for (const t of aOut) aByLine[t.lineIdx]!.push({ t: t.t, s: t.s });
  for (const t of bOut) bByLine[t.lineIdx]!.push({ t: t.t, s: t.s });
  return { a: aByLine, b: bByLine };
}

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

  type Raw = { t: 'eq'; a: string; b: string } | { t: 'del'; a: string } | { t: 'add'; b: string };
  const raw: Raw[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      raw.push({ t: 'eq', a: a[i]!, b: b[j]! });
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      raw.push({ t: 'del', a: a[i]! });
      i++;
    } else {
      raw.push({ t: 'add', b: b[j]! });
      j++;
    }
  }
  while (i < m) raw.push({ t: 'del', a: a[i++]! });
  while (j < n) raw.push({ t: 'add', b: b[j++]! });

  const out: Row[] = [];
  let aLn = 0;
  let bLn = 0;
  let k = 0;
  while (k < raw.length) {
    if (raw[k]!.t === 'eq') {
      const r = raw[k] as { t: 'eq'; a: string; b: string };
      aLn++;
      bLn++;
      out.push({ t: 'eq', a: r.a, b: r.b, an: aLn, bn: bLn });
      k++;
    } else {
      const aLines: string[] = [];
      const bLines: string[] = [];
      const aNums: number[] = [];
      const bNums: number[] = [];
      while (k < raw.length && raw[k]!.t !== 'eq') {
        if (raw[k]!.t === 'del') {
          aLn++;
          aLines.push((raw[k] as { a: string }).a);
          aNums.push(aLn);
        } else {
          bLn++;
          bLines.push((raw[k] as { b: string }).b);
          bNums.push(bLn);
        }
        k++;
      }
      const wd = multiLineWordDiff(aLines, bLines);
      out.push({
        t: 'cluster',
        aLines: aLines.map((text, idx) => ({ text, tokens: wd.a[idx]!, n: aNums[idx]! })),
        bLines: bLines.map((text, idx) => ({ text, tokens: wd.b[idx]!, n: bNums[idx]! })),
      });
    }
  }
  return out;
}

function renderTokens(tokens: Tok[]) {
  return tokens.map((t, i) => {
    if (t.t === 'eq')
      return (
        <span key={i} style={{ opacity: 0.5 }}>
          {t.s}
        </span>
      );
    if (t.t === 'del')
      return (
        <span
          key={i}
          style={{
            background: 'var(--del-strong)',
            borderRadius: 2,
            padding: '0 2px',
            fontWeight: 700,
          }}
        >
          {t.s}
        </span>
      );
    return (
      <span
        key={i}
        style={{
          background: 'var(--add-strong)',
          borderRadius: 2,
          padding: '0 2px',
          fontWeight: 700,
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
          // cluster
          return (
            <div key={i}>
              {r.aLines.map((ln, k) => (
                <div
                  key={`a${k}`}
                  style={{ display: 'flex', padding: '0 12px', background: 'var(--del-bg)' }}
                >
                  <div style={lnStyle}>{ln.n}</div>
                  <div style={lnStyle}></div>
                  <div style={{ ...codeBase, color: 'var(--del)' }}>− {renderTokens(ln.tokens)}</div>
                </div>
              ))}
              {r.bLines.map((ln, k) => (
                <div
                  key={`b${k}`}
                  style={{ display: 'flex', padding: '0 12px', background: 'var(--add-bg)' }}
                >
                  <div style={lnStyle}></div>
                  <div style={lnStyle}>{ln.n}</div>
                  <div style={{ ...codeBase, color: 'var(--add)' }}>+ {renderTokens(ln.tokens)}</div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  // split mode — pad shorter side of each cluster so following eq rows still align
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
          const own = kind === 'a' ? r.aLines : r.bLines;
          const other = kind === 'a' ? r.bLines : r.aLines;
          const padCount = Math.max(0, other.length - own.length);
          const bg = kind === 'a' ? 'var(--del-bg)' : 'var(--add-bg)';
          const fg = kind === 'a' ? 'var(--del)' : 'var(--add)';
          const sigil = kind === 'a' ? '−' : '+';
          return (
            <div key={i}>
              {own.map((ln, k) => (
                <div key={k} style={{ display: 'flex', padding: '0 12px', background: bg }}>
                  <div style={lnStyle}>{ln.n}</div>
                  <div style={{ ...codeBase, color: fg }}>
                    {sigil} {renderTokens(ln.tokens)}
                  </div>
                </div>
              ))}
              {Array.from({ length: padCount }).map((_, k) => (
                <div
                  key={`pad${k}`}
                  style={{ display: 'flex', padding: '0 12px', background: 'var(--gutter)' }}
                >
                  <div style={lnStyle}></div>
                  <div style={{ ...codeBase, color: 'transparent' }}> </div>
                </div>
              ))}
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
