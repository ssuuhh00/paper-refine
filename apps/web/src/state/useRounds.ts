import { useEffect, useState } from 'react';
import type { RoundSummary } from '@paper-refine/shared';
import { api } from '../lib/api';

export function useRounds(projectId: string | null) {
  const [rounds, setRounds] = useState<RoundSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setRounds([]);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    api
      .listRounds(projectId)
      .then((r) => {
        if (!alive) return;
        setRounds(r);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [projectId]);

  return { rounds, loading, error };
}
