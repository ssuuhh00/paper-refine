export type Persona = 'ieee' | 'outsider' | 'writing' | 'structure';
export type ModelTier = 'haiku' | 'sonnet' | 'opus';
export type DecisionState = 'apply' | 'skip' | 'reject' | 'pending';
export type Side = 'A' | 'B';
export type BlindKind = 'original' | 'modified';
export type Severity = 'critical' | 'major' | 'minor';

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

export type ProjectInput = Omit<
  Project,
  'id' | 'created_at' | 'updated_at' | 'output_dir' | 'error_notes_path'
> & {
  output_dir?: string;
  error_notes_path?: string;
};

/**
 * Surrounding text from the .tex file at the time the pipeline ran. Captured
 * per-edit so the user can read each candidate in its original flow.
 */
export type ItemContext = {
  before: string;
  after: string;
  span: number;
};

/**
 * One concrete textual change. A single R item carries N of these so a
 * cross-cutting concern (e.g. terminology unification across files) can be
 * expressed as one decision instead of being shattered into R1.1…R1.N.
 */
export type Edit = {
  /** Section file relative to latex_root (e.g. `00_abstract.tex`). */
  file: string;
  /** Exact substring that must exist in the .tex (used for string-replace). */
  original: string;
  modified: string;
  /** Optional surrounding text — captured by the pipeline at generation time. */
  context?: ItemContext;
};

/** A single citation/quote from the reviewer pointing at a problem location. */
export type Citation = {
  file: string;
  /** Quoted text from the .tex. */
  snippet: string;
  /** Why this location instances the concern. */
  note?: string;
};

/**
 * One review item shared across all four pipeline stages. The `r` field is
 * unique inside a round (each round runs a single persona, so there's no
 * cross-persona collision). decisions.json is keyed by `r`.
 */
export type RoundItem = {
  /** "R1" — unique within the round. */
  r: string;
  /** Stable lookup key — kept identical to `r` for forward compatibility. */
  key: string;
  /** Short headline. */
  title: string;
  severity?: Severity;

  // ── Reviewer output ──────────────────────────────────────────
  /** Detailed description of the problem. */
  concern: string;
  /** All locations the reviewer flagged for this single concern. */
  citations: Citation[];

  // ── Generator output ─────────────────────────────────────────
  /** Rule the generator applies (e.g. "unify terminology to '미들웨어'"). */
  rule: string;
  /** Why this rule resolves the concern. */
  rationale: string;
  /** Concrete edits — usually 1:1 with citations. */
  edits: Edit[];

  // ── Blind shuffle (set by backend, never the LLM) ────────────
  blind: Record<Side, BlindKind>;

  // ── Discriminator output (R-level, one verdict for all edits) ─
  verdict: {
    pick: Side;
    /** Reason from the *modified* perspective. */
    reason: string;
    /** Same reason flipped to address the loser. */
    loserReason: string;
  };
};

export type Decision = {
  state: DecisionState;
  /** Required when state === 'reject'. */
  reason?: string;
  memo?: string;
  decided_at?: string;
  /** Set when apply wrote this R's edits to .tex (or appended to error_notes). */
  applied_at?: string;
};

export type ApplyOutcome = {
  /** R's whose edits were (at least partially) applied. */
  applied: { r: string; editCount: number; sections: string[] }[];
  /** R's that were rejected — appended to error_notes. */
  rejected: { r: string; reason: string }[];
  /** Edits that failed to apply (per-edit failures inside an otherwise applied R). */
  errors: { r: string; section: string; error: string }[];
  /** R's skipped entirely (already applied, no decision, etc.). */
  skipped: { r: string; reason: string }[];
};

export type ApplyRequest = {
  dry_run?: boolean;
};

export type ApplyResponse = ApplyOutcome & {
  dry_run: boolean;
};

export type Round = {
  id: string;
  ts: string;
  project_id: string;
  /** Primary section if the round targeted one, or 'multi' for grouped runs. */
  section: string;
  /** Null for legacy rounds without meta.json. */
  persona: Persona | null;
  /** Null for legacy rounds without meta.json. */
  model: ModelTier | null;
  status: 'in-progress' | 'completed' | 'failed';
  items: RoundItem[];
  /** Keyed by RoundItem.r. */
  decisions: Record<string, Decision>;
  /** Optional discriminator-level summary. */
  summary?: string;
};

export type DecisionsPatch = Record<string, Decision>;

export type RoundMeta = {
  id: string;
  ts: string;
  display_ts: string;
  project_id: string;
  section: string;
  persona: Persona;
  model: ModelTier;
};

export type RoundSummary = {
  id: string;
  ts: string;
  display_ts: string;
  project_id: string;
  section: string;
  persona: Persona | null;
  model: ModelTier | null;
  status: 'in-progress' | 'completed' | 'failed';
  itemCount: number;
  /** Total individual edits across all R items. */
  editCount: number;
  decided: number;
  applyCount: number;
  skipCount: number;
  rejectCount: number;
  pendingCount: number;
  recommendedModified: number;
};

export type ErrorNote = {
  round: string;
  /** Same form as RoundItem.r — used for deep linking. */
  key: string;
  r: string;
  /** Primary section if the R was scoped, else 'multi'. */
  section: string;
  persona: Persona | null;
  source: 'discriminator' | 'user';
  date: string;
  reason: string;
  title: string;
};

export type ProjectValidateRequest = {
  latex_root: string;
  sections_glob?: string;
};

export type ProjectValidateResponse = {
  latex_root: string;
  exists: boolean;
  is_directory: boolean;
  sections_found: number;
  sample_sections: string[];
};

export type RunRequest = {
  project_id: string;
  persona: Persona;
  sections: string[];
  rounds: number;
  model: ModelTier;
  dry_run?: boolean;
};

export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export type Run = {
  id: string;
  project_id: string;
  request: RunRequest;
  status: RunStatus;
  started_at: string;
  finished_at?: string;
  round_ids: string[];
  error?: string;
};

export type PipelineStage = 'review' | 'changes' | 'blind' | 'verdict' | 'done';

export type PipelineEvent =
  | { stage: PipelineStage; type: 'log'; level: 'dim' | 'norm' | 'cyan' | 'green' | 'yellow' | 'red'; msg: string; ts: number }
  | { stage: 'review'; type: 'item'; r: string; title?: string; ts: number }
  | { stage: 'changes'; type: 'pair'; r: string; editCount: number; ts: number }
  | { stage: 'blind'; type: 'map'; r: string; mapping: Record<Side, BlindKind>; ts: number }
  | { stage: 'verdict'; type: 'pick'; r: string; pick: Side; ts: number }
  | { stage: 'done'; type: 'complete'; round_id: string; ts: number }
  | { stage: PipelineStage; type: 'error'; msg: string; ts: number };

// ── JSON schemas exchanged with the LLM ──────────────────────────────────────

export type ReviewerOutput = {
  items: Array<{
    r: string;
    title: string;
    severity?: Severity;
    concern: string;
    citations: Citation[];
  }>;
};

export type GeneratorOutput = {
  items: Array<{
    r: string;
    rule: string;
    rationale: string;
    edits: Array<Pick<Edit, 'file' | 'original' | 'modified'>>;
  }>;
};

export type DiscriminatorOutput = {
  items: Array<{
    r: string;
    pick: Side;
    reason: string;
    loserReason: string;
  }>;
  summary?: string;
};

/** Persisted alongside the round directory (3_blind.json). */
export type BlindFile = {
  items: Array<{
    r: string;
    mapping: Record<Side, BlindKind>;
  }>;
};
