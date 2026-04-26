import { useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * Polls /api/runs every few seconds for the active run id. Used by the
 * TopBar indicator and the LauncherPage auto-resume.
 */
export function useActiveRun(intervalMs = 4000): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      api
        .listRuns()
        .then((r) => {
          if (alive) setActive(r.active);
        })
        .catch(() => {
          /* swallow — TopBar already shows api status */
        });
    };
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return active;
}
