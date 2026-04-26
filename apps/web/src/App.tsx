import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { ProjectProvider, useProjects } from './state/ProjectContext';
import { ThemeProvider, useTheme } from './state/ThemeContext';

export function App() {
  return (
    <ThemeProvider>
      <ProjectProvider>
        <Shell />
      </ProjectProvider>
    </ThemeProvider>
  );
}

function Shell() {
  const { theme } = useTheme();
  return (
    <div
      className={theme}
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <TopBar />
      <FirstRunGate>
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Outlet />
        </main>
      </FirstRunGate>
    </div>
  );
}

/**
 * If the user has no projects yet, force them to /projects so they can register one.
 * The Projects page itself stays accessible always — this only nudges other routes.
 */
function FirstRunGate({ children }: { children: React.ReactNode }) {
  const { projects, loading } = useProjects();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (projects.length === 0 && location.pathname !== '/projects') {
      navigate('/projects', { replace: true });
    }
  }, [loading, projects.length, location.pathname, navigate]);

  return <>{children}</>;
}
