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
 * Invokes the local `claude` CLI:
 *   claude --print --model {model} --system-prompt {sys}
 * Stdin is the user input; stdout is collected and returned.
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

/**
 * Strip the most common LLM-side wrappers around a JSON payload:
 *   - leading prose before the first `{`
 *   - trailing prose after the matching `}`
 *   - markdown code fences (```json ... ```)
 */
export function extractJson(raw: string): string {
  let s = raw.trim();
  // Strip ```json / ``` fences if present.
  const fence = s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fence) s = fence[1]!.trim();
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s;
}

/**
 * Run claude and parse stdout as JSON. On parse failure, retry once with the
 * error appended to the input so the model can self-correct.
 */
export async function runClaudeJson<T>(opts: ClaudeRunOptions): Promise<T> {
  const first = await runClaude(opts);
  try {
    return JSON.parse(extractJson(first)) as T;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const retryInput =
      opts.input +
      '\n\n---\n\n' +
      '## ⚠ 이전 응답이 유효한 JSON이 아니었음\n\n' +
      '이전 응답:\n```\n' +
      first.slice(0, 4000) +
      (first.length > 4000 ? '\n…(truncated)' : '') +
      '\n```\n\n' +
      `파서 에러: ${errMsg}\n\n` +
      '이번에는 위 시스템 프롬프트의 JSON 스키마를 정확히 지켜, 단일 JSON 객체만 출력하라. 마크다운 펜스, 머리말, 꼬리말 모두 금지.';
    const second = await runClaude({ ...opts, input: retryInput });
    try {
      return JSON.parse(extractJson(second)) as T;
    } catch (err2) {
      const e2 = err2 instanceof Error ? err2.message : String(err2);
      throw new Error(
        `claude returned non-JSON twice. last error: ${e2}\n\n--- last 600 chars of stdout ---\n${second.slice(-600)}`,
      );
    }
  }
}
