import { Outlet } from 'react-router-dom';

export function App() {
  return (
    <div className="light" style={{ minHeight: '100%', background: 'var(--bg)' }}>
      <Outlet />
    </div>
  );
}
