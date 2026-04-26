import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { Project, ProjectInput } from '@paper-refine/shared';

const xdgConfig =
  process.env.XDG_CONFIG_HOME ?? path.join(homedir(), '.config');
const CONFIG_DIR = path.join(xdgConfig, 'paper-refine');
const PROJECTS_FILE = path.join(CONFIG_DIR, 'projects.json');

type Store = { projects: Project[] };

async function readStore(): Promise<Store> {
  try {
    const raw = await fs.readFile(PROJECTS_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Store;
    return { projects: Array.isArray(parsed.projects) ? parsed.projects : [] };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { projects: [] };
    }
    throw err;
  }
}

async function writeStore(store: Store): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function now(): string {
  return new Date().toISOString();
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const projectStore = {
  async list(): Promise<Project[]> {
    const { projects } = await readStore();
    return projects;
  },

  async get(id: string): Promise<Project | null> {
    const { projects } = await readStore();
    return projects.find((p) => p.id === id) ?? null;
  },

  async create(input: ProjectInput): Promise<Project> {
    const store = await readStore();
    const ts = now();
    const project: Project = {
      ...input,
      id: genId(),
      created_at: ts,
      updated_at: ts,
    };
    store.projects.push(project);
    await writeStore(store);
    return project;
  },

  async update(id: string, patch: Partial<ProjectInput>): Promise<Project | null> {
    const store = await readStore();
    const idx = store.projects.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    const next: Project = {
      ...store.projects[idx]!,
      ...patch,
      updated_at: now(),
    };
    store.projects[idx] = next;
    await writeStore(store);
    return next;
  },

  async remove(id: string): Promise<boolean> {
    const store = await readStore();
    const before = store.projects.length;
    store.projects = store.projects.filter((p) => p.id !== id);
    if (store.projects.length === before) return false;
    await writeStore(store);
    return true;
  },
};
