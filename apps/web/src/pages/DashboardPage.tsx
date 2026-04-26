import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Persona, RoundSummary } from '@paper-refine/shared';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { RoundCard } from '../components/round/RoundCard';
import { PERSONA_KEYS, PERSONAS } from '../data/personas';
import { useProjects } from '../state/ProjectContext';
import { useRounds } from '../state/useRounds';

type PersonaFilter = Persona | 'all';
type StatusFilter = 'all' | 'pending' | 'completed';

export function DashboardPage() {
  const { current } = useProjects();
  const { rounds, loading, error, removeRound } = useRounds(current?.id ?? null);

  const [personaFilter, setPersonaFilter] = useState<PersonaFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');

  const sectionOptions = useMemo(() => {
    const set = new Set<string>();
    rounds.forEach((r) => set.add(r.section));
    return [...set].sort();
  }, [rounds]);

  const filtered = useMemo(() => {
    return rounds.filter((r) => {
      if (personaFilter !== 'all' && r.persona !== personaFilter) return false;
      if (statusFilter === 'pending' && r.pendingCount === 0) return false;
      if (statusFilter === 'completed' && r.pendingCount > 0) return false;
      if (sectionFilter !== 'all' && r.section !== sectionFilter) return false;
      return true;
    });
  }, [rounds, personaFilter, statusFilter, sectionFilter]);

  const kpi = useMemo(() => computeKpi(rounds), [rounds]);

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
      <div style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 28px 60px' }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: 22,
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--accent)',
                letterSpacing: 0.6,
                marginBottom: 6,
              }}
            >
              {current.name}
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.4, margin: 0 }}>
              라운드 인덱스
            </h1>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '6px 0 0' }}>
              고도화 파이프라인의 누적 결과 · {kpi.totalRounds} rounds · {kpi.totalR} R-items
            </p>
          </div>
          <Link to="/launch" style={{ textDecoration: 'none' }}>
            <Button variant="primary">+ Run new round</Button>
          </Link>
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
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            marginBottom: 22,
          }}
        >
          <Kpi label="총 라운드" value={kpi.totalRounds} unit="rounds" />
          <Kpi label="총 R항목" value={kpi.totalR} unit="items" />
          <Kpi
            label="추천 채택률"
            value={`${kpi.recAdoptRate}%`}
            desc={`Discriminator → modified ${kpi.totalRecModified}/${kpi.totalR}`}
          />
          <Kpi
            label="사용자 적용률"
            value={`${kpi.userApplyRate}%`}
            desc={`apply ${kpi.totalApply}/${kpi.totalR}`}
            accent
          />
        </div>

        <Card style={{ padding: 16, marginBottom: 22 }}>
          <div
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 10.5,
              color: 'var(--ink-3)',
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            페르소나별 R항목 분포
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {PERSONA_KEYS.map((k) => {
              const p = PERSONAS[k];
              const v = kpi.personaCounts[k] ?? 0;
              const max = Math.max(...Object.values(kpi.personaCounts), 1);
              return (
                <div key={k} style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 4,
                      fontSize: 11,
                      fontFamily: 'var(--mono)',
                    }}
                  >
                    <span style={{ color: 'var(--ink-2)' }}>{p.short}</span>
                    <span style={{ color: 'var(--ink-3)' }}>{v}</span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: 'var(--surface-2)',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${(v / max) * 100}%`,
                        background: `oklch(0.55 0.13 ${p.hue})`,
                        transition: 'width 0.3s',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 18 }}>
          <aside>
            <FilterGroup label="페르소나">
              <FilterPill k="all" cur={personaFilter} setCur={(v) => setPersonaFilter(v as PersonaFilter)}>
                전체
              </FilterPill>
              {PERSONA_KEYS.map((k) => {
                const p = PERSONAS[k];
                return (
                  <FilterPill
                    key={k}
                    k={k}
                    cur={personaFilter}
                    setCur={(v) => setPersonaFilter(v as PersonaFilter)}
                    hue={p.hue}
                  >
                    {p.short}
                  </FilterPill>
                );
              })}
            </FilterGroup>
            <FilterGroup label="결정 상태">
              {(['all', 'pending', 'completed'] as const).map((k) => (
                <FilterPill
                  key={k}
                  k={k}
                  cur={statusFilter}
                  setCur={(v) => setStatusFilter(v as StatusFilter)}
                >
                  {k === 'all' ? '전체' : k === 'pending' ? '미결정 있음' : '완료'}
                </FilterPill>
              ))}
            </FilterGroup>
            <FilterGroup label="섹션">
              <FilterPill k="all" cur={sectionFilter} setCur={setSectionFilter}>
                전체
              </FilterPill>
              {sectionOptions.map((s) => (
                <FilterPill key={s} k={s} cur={sectionFilter} setCur={setSectionFilter}>
                  {s}
                </FilterPill>
              ))}
            </FilterGroup>
          </aside>

          <div>
            {loading && rounds.length === 0 ? (
              <Card style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>
                불러오는 중…
              </Card>
            ) : rounds.length === 0 ? (
              <EmptyRounds outputDir={current.output_dir} />
            ) : filtered.length === 0 ? (
              <Card style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>
                조건에 맞는 라운드가 없습니다.
              </Card>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {filtered.map((r) => (
                  <RoundCard key={r.id} round={r} onDelete={removeRound} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  unit,
  desc,
  accent,
}: {
  label: string;
  value: string | number;
  unit?: string;
  desc?: string;
  accent?: boolean;
}) {
  return (
    <Card style={{ padding: 14, position: 'relative', overflow: 'hidden' }}>
      {accent && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: 'var(--accent)',
          }}
        />
      )}
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          color: 'var(--ink-3)',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
        <span
          style={{
            fontSize: 26,
            fontWeight: 600,
            fontFamily: 'var(--mono)',
            letterSpacing: -0.5,
            color: accent ? 'var(--accent)' : 'var(--ink)',
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
            {unit}
          </span>
        )}
      </div>
      {desc && (
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--ink-3)',
            marginTop: 4,
            fontFamily: 'var(--mono)',
          }}
        >
          {desc}
        </div>
      )}
    </Card>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 9.5,
          color: 'var(--ink-3)',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</div>
    </div>
  );
}

function FilterPill({
  k,
  cur,
  setCur,
  children,
  hue,
}: {
  k: string;
  cur: string;
  setCur: (k: string) => void;
  children: React.ReactNode;
  hue?: number;
}) {
  const sel = cur === k;
  return (
    <button
      onClick={() => setCur(k)}
      style={{
        padding: '5px 9px',
        textAlign: 'left',
        border: '1px solid ' + (sel ? 'var(--ink)' : 'transparent'),
        background: sel ? 'var(--surface-2)' : 'transparent',
        color: sel ? 'var(--ink)' : 'var(--ink-2)',
        borderRadius: 4,
        fontSize: 11.5,
        fontFamily: 'var(--mono)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {hue !== undefined && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background: `oklch(0.55 0.15 ${hue})`,
          }}
        />
      )}
      {children}
    </button>
  );
}

function EmptyRounds({ outputDir }: { outputDir: string }) {
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
        no rounds yet
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>
        이 프로젝트에는 아직 라운드가 없습니다.
      </h2>
      <p style={{ fontSize: 12.5, color: 'var(--ink-3)', maxWidth: 440, margin: '0 auto 16px' }}>
        스캔 위치:{' '}
        <span style={{ fontFamily: 'var(--mono)' }}>{outputDir}</span>
      </p>
      <Link to="/launch" style={{ textDecoration: 'none' }}>
        <Button variant="primary">+ 첫 라운드 실행</Button>
      </Link>
    </Card>
  );
}

type Kpi = {
  totalRounds: number;
  totalR: number;
  totalApply: number;
  totalRecModified: number;
  userApplyRate: number;
  recAdoptRate: number;
  personaCounts: Record<string, number>;
};

function computeKpi(rounds: RoundSummary[]): Kpi {
  let totalR = 0;
  let totalApply = 0;
  let totalRecModified = 0;
  const personaCounts: Record<string, number> = {};
  for (const r of rounds) {
    totalR += r.itemCount;
    totalApply += r.applyCount;
    totalRecModified += r.recommendedModified;
    if (r.persona) {
      personaCounts[r.persona] = (personaCounts[r.persona] ?? 0) + r.itemCount;
    }
  }
  return {
    totalRounds: rounds.length,
    totalR,
    totalApply,
    totalRecModified,
    userApplyRate: totalR === 0 ? 0 : Math.round((totalApply / totalR) * 100),
    recAdoptRate: totalR === 0 ? 0 : Math.round((totalRecModified / totalR) * 100),
    personaCounts,
  };
}
