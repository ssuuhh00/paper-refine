import { useState } from 'react';
import type { Project, ProjectInput } from '@paper-refine/shared';
import { api } from '../lib/api';
import { useProjects } from '../state/ProjectContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ProjectForm } from '../components/ProjectForm';

export function ProjectsPage() {
  const { projects, current, loading, error, reload, selectProject } = useProjects();
  const [modal, setModal] = useState<{ kind: 'add' } | { kind: 'edit'; project: Project } | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCreate = async (input: ProjectInput) => {
    setSubmitting(true);
    setActionError(null);
    try {
      const created = await api.createProject(input);
      await reload();
      selectProject(created.id);
      setModal(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id: string, input: ProjectInput) => {
    setSubmitting(true);
    setActionError(null);
    try {
      await api.updateProject(id, input);
      await reload();
      setModal(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      await api.deleteProject(id);
      await reload();
      setConfirmDelete(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', padding: '28px 28px 60px' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            marginBottom: 24,
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: 'var(--accent)',
                letterSpacing: 0.6,
                marginBottom: 6,
              }}
            >
              PROJECTS
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.4, margin: 0 }}>
              프로젝트 관리
            </h1>
            <p
              style={{
                fontSize: 12,
                color: 'var(--ink-3)',
                margin: '6px 0 0',
              }}
            >
              LaTeX 루트를 등록하면 그 디렉토리의 sections를 대상으로 라운드를 돌릴 수 있습니다.
              ·{' '}
              <span style={{ fontFamily: 'var(--mono)' }}>
                ~/.config/paper-refine/projects.json
              </span>
              에 저장됩니다.
            </p>
          </div>
          {projects.length > 0 && (
            <Button variant="primary" onClick={() => setModal({ kind: 'add' })}>
              + 프로젝트 등록
            </Button>
          )}
        </header>

        {error && <ErrorBanner msg={error} />}
        {actionError && <ErrorBanner msg={actionError} />}

        {loading && projects.length === 0 ? (
          <Card style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>
            불러오는 중…
          </Card>
        ) : projects.length === 0 ? (
          <EmptyState onCreate={() => setModal({ kind: 'add' })} />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {projects.map((p) => (
              <ProjectRow
                key={p.id}
                project={p}
                isCurrent={current?.id === p.id}
                onSelect={() => selectProject(p.id)}
                onEdit={() => setModal({ kind: 'edit', project: p })}
                onDelete={() => setConfirmDelete(p)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modal?.kind === 'add'}
        onClose={() => !submitting && setModal(null)}
        title="새 프로젝트 등록"
        subtitle="LaTeX 루트와 섹션 글롭을 입력하세요."
      >
        <ProjectForm
          onSubmit={handleCreate}
          onCancel={() => setModal(null)}
          submitting={submitting}
        />
      </Modal>

      <Modal
        open={modal?.kind === 'edit'}
        onClose={() => !submitting && setModal(null)}
        title="프로젝트 편집"
        subtitle={modal?.kind === 'edit' ? modal.project.name : undefined}
      >
        {modal?.kind === 'edit' && (
          <ProjectForm
            initial={modal.project}
            onSubmit={(input) => handleUpdate(modal.project.id, input)}
            onCancel={() => setModal(null)}
            submitting={submitting}
          />
        )}
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="프로젝트 삭제"
        subtitle={confirmDelete?.name}
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              취소
            </Button>
            <Button
              variant="danger"
              onClick={() => confirmDelete && handleDelete(confirmDelete.id)}
            >
              삭제
            </Button>
          </>
        }
      >
        <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>
          프로젝트 메타 정보만 삭제합니다. <br />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
            {confirmDelete?.output_dir}
          </span>
          {' '}안의 라운드 파일들은 그대로 남습니다.
        </p>
      </Modal>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <Card style={{ padding: '48px 28px', textAlign: 'center' }}>
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 11,
          color: 'var(--ink-3)',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        first run
      </div>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 8px' }}>
        등록된 프로젝트가 없습니다.
      </h2>
      <p
        style={{
          fontSize: 13,
          color: 'var(--ink-3)',
          maxWidth: 420,
          margin: '0 auto 20px',
          lineHeight: 1.55,
        }}
      >
        고도화할 논문의 LaTeX 루트를 먼저 등록하세요. 등록 후 라운드를 돌리고 결정 이력을
        누적할 수 있습니다.
      </p>
      <Button variant="primary" onClick={onCreate}>
        + 프로젝트 등록
      </Button>
    </Card>
  );
}

function ProjectRow({
  project,
  isCurrent,
  onSelect,
  onEdit,
  onDelete,
}: {
  project: Project;
  isCurrent: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      style={{
        padding: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        borderColor: isCurrent ? 'var(--accent)' : 'var(--border)',
        borderLeft: isCurrent ? '3px solid var(--accent)' : '1px solid var(--border)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
            {project.name}
          </span>
          {isCurrent && (
            <span
              style={{
                fontFamily: 'var(--mono)',
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: 0.5,
                padding: '1px 6px',
                background: 'var(--accent-bg)',
                color: 'var(--accent)',
                borderRadius: 3,
              }}
            >
              CURRENT
            </span>
          )}
        </div>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 11,
            color: 'var(--ink-3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {project.latex_root}
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginTop: 6,
            fontFamily: 'var(--mono)',
            fontSize: 10.5,
            color: 'var(--ink-3)',
          }}
        >
          <span>glob {project.sections_glob}</span>
          <span>·</span>
          <span>updated {fmtDate(project.updated_at)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {!isCurrent && (
          <Button size="sm" variant="ghost" onClick={onSelect}>
            선택
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={onEdit}>
          편집
        </Button>
        <Button size="sm" variant="danger" onClick={onDelete}>
          삭제
        </Button>
      </div>
    </Card>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <Card
      style={{
        padding: '10px 14px',
        marginBottom: 14,
        borderColor: 'var(--warn)',
        background: 'var(--warn-bg)',
      }}
    >
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--warn)' }}>
        {msg}
      </div>
    </Card>
  );
}

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}
