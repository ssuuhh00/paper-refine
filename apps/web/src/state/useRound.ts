import { useCallback, useEffect, useRef, useState } from 'react';
import type { Decision, DecisionsPatch, Round } from '@paper-refine/shared';
import { api } from '../lib/api';

type Result = {
  round: Round | null;
  loading: boolean;
  error: string | null;
  /** Optimistically update + persist a single decision. */
  setDecision: (key: string, decision: Decision) => void;
  reload: () => Promise<void>;
};

export function useRound(projectId: string | null, roundId: string | null): Result {
  const [round, setRound] = useState<Round | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flushTimer = useRef<number | null>(null);
  const pending = useRef<DecisionsPatch>({});

  const reload = useCallback(async () => {
    if (!projectId || !roundId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.getRound(projectId, roundId);
      setRound(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [projectId, roundId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const flush = useCallback(async () => {
    if (!projectId || !roundId) return;
    const batch = pending.current;
    pending.current = {};
    if (Object.keys(batch).length === 0) return;
    try {
      await api.patchDecisions(projectId, roundId, batch);
    } catch (err) {
      // re-merge into pending so next flush retries
      pending.current = { ...batch, ...pending.current };
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [projectId, roundId]);

  const setDecision = useCallback(
    (key: string, decision: Decision) => {
      // optimistic update
      setRound((prev) =>
        prev
          ? {
              ...prev,
              decisions: {
                ...prev.decisions,
                [key]: { ...decision, decided_at: decision.decided_at ?? new Date().toISOString() },
              },
            }
          : prev,
      );
      pending.current[key] = decision;
      if (flushTimer.current) window.clearTimeout(flushTimer.current);
      flushTimer.current = window.setTimeout(() => {
        void flush();
      }, 250);
    },
    [flush],
  );

  // flush on unmount / route change
  useEffect(
    () => () => {
      if (flushTimer.current) {
        window.clearTimeout(flushTimer.current);
        void flush();
      }
    },
    [flush],
  );

  return { round, loading, error, setDecision, reload };
}
