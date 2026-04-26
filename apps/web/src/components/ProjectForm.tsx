import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  Project,
  ProjectInput,
  ProjectValidateResponse,
} from '@paper-refine/shared';
import { api } from '../lib/api';
import { Field } from './ui/Field';
import { TextInput } from './ui/TextInput';
import { Button } from './ui/Button';

const DEFAULT_GLOB = 'sections/*.tex';

type Props = {
  initial?: Project | null;
  onSubmit: (input: ProjectInput) => Promise<void>;
  onCancel: () => void;
  submitting?: boolean;
};

export function ProjectForm({ initial, onSubmit, onCancel, submitting = false }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [latexRoot, setLatexRoot] = useState(initial?.latex_root ?? '');
  const [sectionsGlob, setSectionsGlob] = useState(initial?.sections_glob ?? DEFAULT_GLOB);
  const [outputDir, setOutputDir] = useState(initial?.output_dir ?? '');
  const [errorNotes, setErrorNotes] = useState(initial?.error_notes_path ?? '');
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(initial?.output_dir || initial?.error_notes_path),
  );

  const [validation, setValidation] = useState<ProjectValidateResponse | null>(null);
  const [validating, setValidating] = useState(false);

  const debounceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!latexRoot.trim()) {
      setValidation(null);
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      let cancelled = false;
      setValidating(true);
      api
        .validateProject({ latex_root: latexRoot, sections_glob: sectionsGlob || DEFAULT_GLOB })
        .then((res) => {
          if (!cancelled) setValidation(res);
        })
        .catch(() => {
          if (!cancelled) setValidation(null);
        })
        .finally(() => {
          if (!cancelled) setValidating(false);
        });
      return () => {
        cancelled = true;
      };
    }, 280);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [latexRoot, sectionsGlob]);

  const derivedOutput = useMemo(() => {
    const root = validation?.latex_root || latexRoot.trim();
    if (!root) return '';
    return `${root.replace(/\/$/, '')}/refine_output`;
  }, [validation, latexRoot]);

  const derivedNotes = useMemo(() => {
    const out = outputDir.trim() || derivedOutput;
    if (!out) return '';
    return `${out.replace(/\/$/, '')}/error_notes.md`;
  }, [outputDir, derivedOutput]);

  const canSubmit =
    !submitting &&
    name.trim().length > 0 &&
    latexRoot.trim().length > 0 &&
    validation?.exists === true &&
    validation?.is_directory === true;

  const submit = async () => {
    if (!canSubmit) return;
    await onSubmit({
      name: name.trim(),
      latex_root: latexRoot.trim(),
      sections_glob: sectionsGlob.trim() || DEFAULT_GLOB,
      output_dir: outputDir.trim() || derivedOutput,
      error_notes_path: errorNotes.trim() || derivedNotes,
    });
  };

  return (
    <div>
      <Field label="이름" desc="짧은 식별자. 라운드 디렉토리·UI 셀렉터에 노출됩니다.">
        <TextInput
          mono={false}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="IEEE_ACCESS"
          autoFocus
        />
      </Field>

      <Field
        label="LaTeX 루트"
        desc="섹션 파일이 들어 있는 논문 디렉토리의 절대경로. ~ 사용 가능."
        hint={<ValidationHint validating={validating} validation={validation} />}
      >
        <TextInput
          value={latexRoot}
          onChange={(e) => setLatexRoot(e.target.value)}
          placeholder="/home/lsh/ws/src/multi-protocol-gateway/docs/paper/IEEE_ACCESS"
        />
      </Field>

      <Field label="섹션 글롭" desc="LaTeX 루트 기준 상대 패턴">
        <TextInput
          value={sectionsGlob}
          onChange={(e) => setSectionsGlob(e.target.value)}
          placeholder={DEFAULT_GLOB}
        />
      </Field>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        style={{
          background: 'transparent',
          border: 'none',
          padding: '4px 0',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--ink-3)',
          cursor: 'pointer',
          marginBottom: 12,
        }}
      >
        {showAdvanced ? '▾' : '▸'} 고급 (출력 위치 직접 지정)
      </button>

      {showAdvanced && (
        <>
          <Field
            label="출력 디렉토리"
            desc="라운드 산출물(1_review.md ~ decisions.json)이 누적될 위치."
            hint={
              !outputDir.trim() && derivedOutput ? (
                <span>
                  비워두면 <code style={{ color: 'var(--ink-2)' }}>{derivedOutput}</code> 사용
                </span>
              ) : null
            }
          >
            <TextInput
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              placeholder={derivedOutput || '<latex_root>/refine_output'}
            />
          </Field>

          <Field
            label="오답노트 경로"
            desc="거부된 수정안 사유가 누적되는 마크다운 파일."
            hint={
              !errorNotes.trim() && derivedNotes ? (
                <span>
                  비워두면 <code style={{ color: 'var(--ink-2)' }}>{derivedNotes}</code> 사용
                </span>
              ) : null
            }
          >
            <TextInput
              value={errorNotes}
              onChange={(e) => setErrorNotes(e.target.value)}
              placeholder={derivedNotes || '<output_dir>/error_notes.md'}
            />
          </Field>
        </>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          marginTop: 8,
        }}
      >
        <Button variant="ghost" onClick={onCancel} disabled={submitting}>
          취소
        </Button>
        <Button variant="primary" onClick={submit} disabled={!canSubmit}>
          {submitting ? '저장 중…' : initial ? '저장' : '등록'}
        </Button>
      </div>
    </div>
  );
}

function ValidationHint({
  validating,
  validation,
}: {
  validating: boolean;
  validation: ProjectValidateResponse | null;
}) {
  if (validating) {
    return <span style={{ color: 'var(--ink-3)' }}>확인 중…</span>;
  }
  if (!validation) {
    return <span style={{ color: 'var(--ink-3)' }}>경로를 입력하면 자동으로 검증합니다.</span>;
  }
  if (!validation.exists) {
    return <span style={{ color: 'var(--warn)' }}>✗ 경로가 존재하지 않음</span>;
  }
  if (!validation.is_directory) {
    return <span style={{ color: 'var(--warn)' }}>✗ 디렉토리가 아님</span>;
  }
  if (validation.sections_found === 0) {
    return (
      <span style={{ color: 'var(--warn)' }}>
        ⚠ 디렉토리는 존재하지만 섹션 파일을 찾지 못함 — 글롭을 확인하세요.
      </span>
    );
  }
  return (
    <span>
      <span style={{ color: 'var(--ok)' }}>
        ✓ {validation.sections_found}개 섹션 매칭
      </span>{' '}
      <span style={{ color: 'var(--ink-3)' }}>
        ({validation.sample_sections.slice(0, 3).join(', ')}
        {validation.sections_found > 3 ? `, +${validation.sections_found - 3}` : ''})
      </span>
    </span>
  );
}
