import { spawn } from 'node:child_process';

export type ClaudeRunOptions = {
  model: string;
  systemPrompt: string;
  input: string;
  /** Called for each stdout/stderr chunk while the CLI is running. */
  onChunk?: (chunk: string, stream: 'stdout' | 'stderr') => void;
  /** Aborts the running process. */
  signal?: AbortSignal;
};

/**
 * Invokes the local `claude` CLI with the same surface refine.sh used:
 *   claude --print --model {model} --system-prompt {sys}
 * Stdin is the user input; stdout is collected and returned. Stderr is
 * captured into `onChunk` so the UI can surface diagnostics.
 */
export async function runClaude(opts: ClaudeRunOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'claude',
      ['--print', '--model', opts.model, '--system-prompt', opts.systemPrompt],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );

    let stdout = '';
    let stderr = '';
    let aborted = false;

    const onAbort = () => {
      aborted = true;
      child.kill('SIGTERM');
    };
    if (opts.signal) {
      if (opts.signal.aborted) {
        onAbort();
      } else {
        opts.signal.addEventListener('abort', onAbort);
      }
    }

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
      opts.onChunk?.(chunk, 'stdout');
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
      opts.onChunk?.(chunk, 'stderr');
    });

    child.on('error', (err) => {
      cleanup();
      reject(err);
    });

    child.on('exit', (code, signal) => {
      cleanup();
      if (aborted) {
        reject(new Error('claude run aborted'));
        return;
      }
      if (code !== 0) {
        const tail = stderr.trim().split('\n').slice(-5).join('\n');
        reject(new Error(`claude exited code=${code} signal=${signal ?? ''}${tail ? `\n${tail}` : ''}`));
        return;
      }
      resolve(stdout);
    });

    function cleanup() {
      if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
    }

    try {
      child.stdin.end(opts.input);
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

/** Quick existence check so we can fail with a friendly error before spawning. */
export async function checkClaudeAvailable(): Promise<{ ok: boolean; version?: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn('claude', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (err += c));
    child.on('error', (e) => resolve({ ok: false, error: String(e?.message ?? e) }));
    child.on('exit', (code) => {
      if (code === 0) resolve({ ok: true, version: out.trim() });
      else resolve({ ok: false, error: err.trim() || `exit ${code}` });
    });
  });
}
