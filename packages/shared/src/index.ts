export type Persona = 'ieee' | 'outsider' | 'writing' | 'structure';
export type ModelTier = 'haiku' | 'sonnet' | 'opus';
export type DecisionState = 'apply' | 'skip' | 'reject' | 'pending';
export type Side = 'A' | 'B';
export type BlindKind = 'original' | 'modified';

export type Project = {
  id: string;
  name: string;
  latex_root: string;
  sections_glob: string;
  output_dir: string;
  error_notes_path: string;
  created_at: string;
  updated_at: string;
};

export type ProjectInput = Omit<Project, 'id' | 'created_at' | 'updated_at'>;

/**
 * Surrounding text from the .tex section file, captured at pipeline time
 * so the user can read the blind candidate in its original flow even after
 * the .tex has been edited.
 */
export type ItemContext = {
  before: string;
  after: string;
  /** Total bytes captured on each side (before/after may be shorter at file edges). */
  span: number;
};

export type RoundItem = {
  /** "R1" — may repeat across items, disambiguate via `key`. */
  r: string;
  /** Stable identity within a round: `${r}#${occurrence}`. */
  key: string;
  occurrence: number;
  title: string;
  location: string;
  section: string;
  cite: string;
  issue: string;
  original: string;
  modified: string;
  rationale: string;
  blind: Record<Side, BlindKind>;
  verdict: {
    pick: Side;
    reason: string;
    loserReason: string;
  };
  context?: ItemContext;
};

export type Decision = {
  state: DecisionState;
  /** Required when state === 'reject'. */
  reason?: string;
  memo?: string;
  decided_at?: string;
};

export type Round = {
  id: string;
  ts: string;
  project_id: string;
  /** Primary section if the round targeted one, or 'multi' for grouped runs. */
  section: string;
  persona: Persona;
  model: ModelTier;
  status: 'in-progress' | 'completed' | 'failed';
  items: RoundItem[];
  decisions: Record<string, Decision>;
};

export type RoundSummary = Pick<
  Round,
  'id' | 'ts' | 'project_id' | 'section' | 'persona' | 'model' | 'status'
> & {
  itemCount: number;
  decided: number;
  applyCount: number;
  recommendedModified: number;
};

export type ErrorNote = {
  round: string;
  r: string;
  section: string;
  persona: Persona;
  source: 'discriminator' | 'user';
  date: string;
  reason: string;
  title: string;
};

export type RunRequest = {
  project_id: string;
  persona: Persona;
  sections: string[];
  rounds: number;
  model: ModelTier;
  dry_run?: boolean;
};

export type PipelineStage = 'review' | 'changes' | 'blind' | 'verdict' | 'done';

export type PipelineEvent =
  | { stage: PipelineStage; type: 'log'; level: 'dim' | 'norm' | 'cyan' | 'green' | 'yellow' | 'red'; msg: string; ts: number }
  | { stage: 'review'; type: 'item'; r: string; title?: string; location?: string; ts: number }
  | { stage: 'changes'; type: 'pair'; r: string; ts: number }
  | { stage: 'blind'; type: 'map'; r: string; mapping: Record<Side, BlindKind>; ts: number }
  | { stage: 'verdict'; type: 'pick'; r: string; pick: Side; ts: number }
  | { stage: 'done'; type: 'complete'; round_id: string; ts: number }
  | { stage: PipelineStage; type: 'error'; msg: string; ts: number };
