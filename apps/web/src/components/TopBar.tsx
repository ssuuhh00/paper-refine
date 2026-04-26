import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useProjects } from '../state/ProjectContext';
import { useActiveRun } from '../state/useActiveRun';
import { useTheme } from '../state/ThemeContext';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/launch', label: 'Launch' },
  { to: '/error-notes', label: 'Notes' },
  { to: '/projects', label: 'Projects' },
];

export function TopBar() {
  const { projects, current, selectProject } = useProjects();
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const activeRun = useActiveRun();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    let alive = true;
    const ping = () => {
      api
        .health()
        .then(() => alive && setHealthOk(true))
        .catch(() => alive && setHealthOk(false));
    };
    ping();
    const id = window.setInterval(ping, 15000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <div
      style={{
        padding: '12px 24px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <Link
        to="/"
        style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            background: 'var(--ink)',
            color: 'var(--bg)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--mono)',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          R
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2, color: 'var(--ink)' }}>
          paper-refine
        </div>
      </Link>

      <ProjectSelector
        projects={projects}
        currentId={current?.id ?? null}
        onSelect={selectProject}
      />

      <nav style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            style={({ isActive }) => ({
              padding: '5px 10px',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: isActive ? 'var(--ink)' : 'var(--ink-3)',
              textDecoration: 'none',
              borderRadius: 4,
              background: isActive ? 'var(--surface-2)' : 'transparent',
              fontWeight: isActive ? 600 : 500,
            })}
          >
            {n.label}
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {activeRun && (
        <button
          onClick={() => navigate(`/launch?run=${encodeURIComponent(activeRun)}`)}
          title={`진행 중인 라운드 — ${activeRun}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: 'var(--accent-bg)',
            border: '1px solid var(--accent)',
            borderRadius: 5,
            fontFamily: 'var(--mono)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--accent)',
            cursor: 'pointer',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              background: 'var(--accent)',
              animation: 'pulse 1.4s infinite',
            }}
          />
          run · in progress
        </button>
      )}

      <button
        onClick={toggle}
        title={`테마: ${theme}`}
        aria-label="theme toggle"
        style={{
          width: 26,
          height: 26,
          padding: 0,
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 5,
          cursor: 'pointer',
          color: 'var(--ink-2)',
          fontSize: 13,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>

      <span
        title={`API ${healthOk === null ? '확인중' : healthOk ? '정상' : '연결 실패'}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: 'var(--mono)',
          fontSize: 10.5,
          color:
            healthOk === null ? 'var(--ink-3)' : healthOk ? 'var(--ok)' : 'var(--warn)',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            background:
              healthOk === null
                ? 'var(--ink-4)'
                : healthOk
                  ? 'var(--ok)'
                  : 'var(--warn)',
          }}
        />
        api · {healthOk === null ? '…' : healthOk ? 'ok' : 'down'}
      </span>

      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-4)' }}>
        {location.pathname}
      </span>
    </div>
  );
}

function ProjectSelector({
  projects,
  currentId,
  onSelect,
}: {
  projects: { id: string; name: string }[];
  currentId: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (projects.length === 0) {
    return (
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10.5,
          color: 'var(--warn)',
          padding: '3px 8px',
          background: 'var(--warn-bg)',
          borderRadius: 4,
        }}
      >
        프로젝트 없음
      </span>
    );
  }
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 6px 3px 10px',
        background: 'var(--surface-2)',
        borderRadius: 5,
        border: '1px solid var(--border)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 9.5,
          color: 'var(--ink-3)',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        project
      </span>
      <select
        value={currentId ?? ''}
        onChange={(e) => onSelect(e.target.value || null)}
        style={{
          appearance: 'none',
          border: 'none',
          background: 'transparent',
          fontFamily: 'var(--mono)',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--ink)',
          padding: '2px 18px 2px 4px',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}
