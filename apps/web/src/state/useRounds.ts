import { useCallback, useEffect, useState } from 'react';
import type { RoundSummary } from '@paper-refine/shared';
import { api } from '../lib/api';

export function useRounds(projectId: string | null) {
  const [rounds, setRounds] = useState<RoundSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!projectId) {
      setRounds([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await api.listRounds(projectId);
      setRounds(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let alive = true;
    void reload().then(() => {
      if (!alive) return;
    });
    return () => {
      alive = false;
    };
  }, [reload]);

  const removeRound = useCallback(
    async (id: string) => {
      if (!projectId) return;
      await api.deleteRound(projectId, id);
      setRounds((prev) => prev.filter((r) => r.id !== id));
    },
    [projectId],
  );

  return { rounds, loading, error, reload, removeRound };
}
