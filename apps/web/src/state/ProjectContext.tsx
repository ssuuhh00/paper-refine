import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Project } from '@paper-refine/shared';
import { api } from '../lib/api';

const STORAGE_KEY = 'paper-refine.current_project_id';

type ProjectContextValue = {
  projects: Project[];
  current: Project | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  selectProject: (id: string | null) => void;
};

const Ctx = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEY),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listProjects();
      setProjects(list);
      setCurrentId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev;
        const next = list[0]?.id ?? null;
        if (next) localStorage.setItem(STORAGE_KEY, next);
        else localStorage.removeItem(STORAGE_KEY);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectProject = useCallback((id: string | null) => {
    setCurrentId(id);
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects,
      current: projects.find((p) => p.id === currentId) ?? null,
      loading,
      error,
      reload,
      selectProject,
    }),
    [projects, currentId, loading, error, reload, selectProject],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProjects(): ProjectContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useProjects must be used inside <ProjectProvider>');
  return v;
}
