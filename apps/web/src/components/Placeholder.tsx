import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

type Props = {
  title: string;
  subtitle: string;
};

export function Placeholder({ title, subtitle }: Props) {
  const [healthOk, setHealthOk] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .health()
      .then(() => setHealthOk(true))
      .catch(() => setHealthOk(false));
  }, []);

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        color: 'var(--ink)',
        fontFamily: 'var(--sans)',
      }}
    >
      <div
        style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>paper-refine</div>
        </div>
        <nav style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
          <NavItem to="/">Dashboard</NavItem>
          <NavItem to="/projects">Projects</NavItem>
          <NavItem to="/launch">Launch</NavItem>
          <NavItem to="/rounds/sample">Workspace</NavItem>
          <NavItem to="/error-notes">Notes</NavItem>
        </nav>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color:
              healthOk === null
                ? 'var(--ink-3)'
                : healthOk
                  ? 'var(--ok)'
                  : 'var(--warn)',
          }}
        >
          api · {healthOk === null ? 'checking…' : healthOk ? 'ok' : 'down'}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--ink-3)',
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          stub
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{title}</h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0 }}>{subtitle}</p>
      </div>
    </div>
  );
}

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      style={{
        padding: '5px 10px',
        fontFamily: 'var(--mono)',
        fontSize: 11,
        color: 'var(--ink-2)',
        textDecoration: 'none',
        borderRadius: 4,
      }}
    >
      {children}
    </Link>
  );
}
