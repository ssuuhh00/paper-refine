import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { Project, ProjectInput } from '@paper-refine/shared';
import {
  defaultErrorNotes,
  defaultOutputDir,
  isLegacyOutputDir,
} from '../util/paths.js';

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

/**
 * Migrate projects whose output_dir/error_notes_path still point at the
 * old <latex_root>/refine_output layout (or are empty) to the new
 * <repo>/data/projects/<id> layout. Existing files in the old location
 * are NOT moved automatically — only the metadata.
 */
function migrateLegacyPaths(p: Project): { project: Project; changed: boolean } {
  const wantOutput = defaultOutputDir(p.id);
  const wantNotes = defaultErrorNotes(p.id);
  let changed = false;
  let next = p;
  if (isLegacyOutputDir(p.output_dir) && p.output_dir !== wantOutput) {
    next = { ...next, output_dir: wantOutput, error_notes_path: wantNotes };
    changed = true;
  } else if (!p.error_notes_path) {
    next = { ...next, error_notes_path: path.join(p.output_dir, 'error_notes.md') };
    changed = true;
  }
  return { project: next, changed };
}

async function loadAndMigrate(): Promise<Store> {
  const store = await readStore();
  let dirty = false;
  store.projects = store.projects.map((p) => {
    const { project, changed } = migrateLegacyPaths(p);
    if (changed) dirty = true;
    return project;
  });
  if (dirty) await writeStore(store);
  return store;
}

export const projectStore = {
  async list(): Promise<Project[]> {
    const { projects } = await loadAndMigrate();
    return projects;
  },

  async get(id: string): Promise<Project | null> {
    const { projects } = await loadAndMigrate();
    return projects.find((p) => p.id === id) ?? null;
  },

  async create(input: ProjectInput): Promise<Project> {
    const store = await readStore();
    const ts = now();
    const id = genId();
    const output_dir = input.output_dir || defaultOutputDir(id);
    const error_notes_path =
      input.error_notes_path || path.join(output_dir, 'error_notes.md');
    const project: Project = {
      ...input,
      id,
      output_dir,
      error_notes_path,
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
    const current = store.projects[idx]!;
    const next: Project = {
      ...current,
      ...patch,
      output_dir: patch.output_dir || current.output_dir,
      error_notes_path: patch.error_notes_path || current.error_notes_path,
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
