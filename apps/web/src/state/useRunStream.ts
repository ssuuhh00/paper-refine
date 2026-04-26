import { useEffect, useState } from 'react';
import type { PipelineEvent, Run } from '@paper-refine/shared';

type Status = 'connecting' | 'open' | 'ended' | 'error';

export function useRunStream(runId: string | null) {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [run, setRun] = useState<Run | null>(null);
  const [status, setStatus] = useState<Status>('connecting');

  useEffect(() => {
    if (!runId) {
      setEvents([]);
      setRun(null);
      setStatus('connecting');
      return;
    }
    setEvents([]);
    setRun(null);
    setStatus('connecting');

    const es = new EventSource(`/api/runs/${encodeURIComponent(runId)}/stream`);

    es.addEventListener('event', (e) => {
      try {
        const ev = JSON.parse((e as MessageEvent).data) as PipelineEvent;
        setEvents((prev) => [...prev, ev]);
      } catch {
        // ignore malformed
      }
    });
    es.addEventListener('state', (e) => {
      try {
        setRun(JSON.parse((e as MessageEvent).data) as Run);
      } catch {
        /* ignore */
      }
    });
    es.addEventListener('end', (e) => {
      try {
        setRun(JSON.parse((e as MessageEvent).data) as Run);
      } catch {
        /* ignore */
      }
      setStatus('ended');
      es.close();
    });
    es.onopen = () => setStatus('open');
    es.onerror = () => {
      setStatus((s) => (s === 'ended' ? s : 'error'));
    };

    return () => {
      es.close();
    };
  }, [runId]);

  return { events, run, status };
}
