# paper-refine

논문 고도화 4단계 자동 파이프라인의 **웹 워크벤치**.
Reviewer → Generator → 블라인드 A/B → Discriminator → 사용자 최종 결정 → `.tex` 일괄 반영.

```
Reviewer ──→ Generator ──→ [A/B 셔플] ──→ Discriminator ──→ 사용자 결정 ──→ .tex
(1_review)  (2_changes)    (3_blind)      (4_verdict)      (decisions)        │
                                                                              ↓
                                                                      거부 사유는
                                                                  error_notes.md로
                                                          (다음 라운드 Generator가 학습)
```

초기 셸 프로토타입(refine.sh)을 TypeScript로 재구현해 웹 UI로 감쌌다.
핵심 차이: **셸 버전의 Step 5(.tex 자동 반영)는 사용자가 R항목별로
apply/skip/reject를 결정한 뒤 트리거**한다.

---

## 빠른 시작

```bash
./start.sh
```

- 의존성 자동 설치(첫 실행)
- 백엔드(`:3001`) + 프론트(`:5173`) 동시 기동
- 준비되면 기본 브라우저로 자동 오픈
- `Ctrl+C`로 둘 다 정리

옵션:
```bash
SERVER_PORT=4000 WEB_PORT=4173 ./start.sh   # 포트 변경
./start.sh --no-open                         # 브라우저 자동 오픈 끄기
```

요구 사항:
- Node.js ≥ 18.18
- `claude` CLI (Anthropic) — 파이프라인 실행 시 필요. dry-run은 없어도 OK.

---

## 페이지 워크플로우

| 페이지 | 역할 |
|:---|:---|
| **Projects** (`/projects`) | LaTeX 루트 디렉토리 등록·편집·삭제. 인라인 검증으로 sections glob 매칭 미리보기 |
| **Dashboard** (`/`) | 프로젝트의 라운드 인덱스. KPI(총 R항목, 추천 채택률, 사용자 적용률), 페르소나 분포, 라운드 카드 그리드 |
| **Launch** (`/launch`) | 페르소나·섹션·라운드 수·모델 골라서 파이프라인 실행. 진행 콘솔(SSE), 4 stage 카운터, 취소 |
| **Workspace** (`/rounds/:id`) | R 항목별로 4단계(Review/Changes/Blind/Verdict)를 한 흐름으로 보고 결정. 블라인드 카드는 `.tex` 원본의 ±N자 surrounding 컨텍스트와 함께 표시 |
| **Notes** (`/error-notes`) | 사용자/Discriminator 거부 사유 누적 타임라인. 페르소나별 빈도 |

### 키보드 단축키 (워크스페이스)
- `A` / `S` / `R` — 현재 R항목을 apply / skip / reject로 결정 (자동 저장)
- `←` / `→` — R항목 이동
- `↑` / `↓` — step(Review/Changes/Blind/Verdict) 점프

### 동시 실행 제약
파이프라인은 동시 1건만 허용 (claude CLI 충돌 방지). 진행 중이면 다른 페이지에서도
TopBar에 펄스 인디케이터로 표시되고, `/launch` 진입 시 자동으로 그 라운드의 진행 화면으로 점프.

---

## 데이터 위치

- **프로젝트 메타** — `${XDG_CONFIG_HOME:-~/.config}/paper-refine/projects.json`
- **라운드 산출물** — `<latex_root>/refine_output/<ts>_round_NNN/`
  - `meta.json` — persona/model/sections (대시보드용)
  - `1_review.md` — 리뷰어 지적 (R 항목 헤더)
  - `2_changes.md` + `2_changes.json` — 원문/수정 쌍 (markdown은 사람용, json은 컨텍스트 포함 구조화)
  - `3_blind_test.md` + `3_mapping.txt` — A/B 셔플 + 역매핑(비공개)
  - `4_verdict.md` — Discriminator 판정
  - `decisions.json` — 사용자 결정 (`{state, reason?, memo?, decided_at, applied_at?}`)
- **오답노트** — `<latex_root>/refine_output/error_notes.md` (다음 라운드 Generator 입력)

라운드 산출물이 논문 리포 옆에 떨어지므로 git에 함께 커밋하면 결정 이력이 보존된다.

---

## 스택

```
paper-refine/
├── apps/
│   ├── web/         Vite + React 18 + TypeScript (포트 5173)
│   └── server/      Fastify + TypeScript (포트 3001)
│       └── prompts/ vendored: reviewer_{4종}, generator, discriminator
├── packages/
│   └── shared/      도메인 타입 (Project, Round, Decision, PipelineEvent ...)
└── start.sh         dev 런처
```

- npm workspaces, ESM only
- 백엔드는 `child_process.spawn`으로 `claude --print --model X --system-prompt Y` 호출
- SSE로 파이프라인 이벤트 라이브 스트림
- 디자인 토큰은 `apps/web/src/styles/globals.css`에 박혀 있음 (light/dark 둘 다)
- Tailwind 미사용 — inline style + CSS 변수

수동 실행:
```bash
npm install
npm run dev:server   # 터미널 1, :3001
npm run dev:web      # 터미널 2, :5173
```

타입체크/빌드:
```bash
npm run typecheck
npm run build
```

---

## API 요약

| 엔드포인트 | 용도 |
|:---|:---|
| `GET /api/health` | 헬스체크 |
| `GET/POST/PATCH/DELETE /api/projects[/:id]` | 프로젝트 CRUD |
| `POST /api/projects/validate` | LaTeX 루트 + 글롭 인라인 검증 |
| `GET /api/projects/:id/sections` | 매칭되는 섹션 파일 목록 |
| `GET /api/rounds?project_id=` | 라운드 인덱스 (요약) |
| `GET /api/rounds/:id?project_id=` | 라운드 상세 (5파일 머지 + 컨텍스트) |
| `PATCH /api/rounds/:id/decisions` | R항목 결정 부분 업데이트 |
| `POST /api/rounds/:id/apply` | 결정된 항목 .tex 일괄 반영 (dry_run 지원) |
| `POST /api/rounds/run` | 새 파이프라인 실행 트리거 |
| `GET /api/runs/:id/stream` | 진행 이벤트 SSE 스트림 (replay + live) |
| `POST /api/runs/:id/cancel` | 진행 중 라운드 취소 |
| `GET /api/error-notes?project_id=` | 거부 사유 집계 (사용자 + Discriminator) |

---

## 라이선스

내부용 도구. 공개 시 라이선스 추가 예정.
