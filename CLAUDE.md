# paper-refine

논문 고도화 4단계 자동 파이프라인의 **웹 워크벤치**.
초기 셸 프로토타입(refine.sh)을 TypeScript로 재구현해 웹 UI로 감쌌다.

```
Reviewer → Generator → [A/B 셔플] → Discriminator → 사용자 최종 결정 → .tex 반영
(1_review)  (2_changes)   (3_blind)    (4_verdict)    (decisions.json)
                                                            │
                                                    거부 사유 → error_notes.md
```

셸 버전은 **Step 5에서 .tex 자동 반영 + 오답노트 추가**까지 일괄 수행했지만,
paper-refine은 Step 5를 **사용자 결정 시점**으로 분리한다.

---

## 스택 (확정)

- **모노레포**: npm workspaces
- **frontend**: Vite + React 18 + TypeScript (`apps/web`)
- **backend**: Fastify + TypeScript (`apps/server`)
- **공유 타입**: `packages/shared`
- **스타일**: Tailwind 미사용. 디자인 토큰을 `apps/web/src/styles/globals.css`에 박고 컴포넌트는 inline style + CSS 변수
- **폰트**: Pretendard / Inter (sans), JetBrains Mono (라벨·코드·수치)

```
paper-refine/
├── apps/
│   ├── web/             Vite + React
│   └── server/          Fastify
├── packages/
│   └── shared/          Project, Round, Decision, PipelineEvent 등 타입
├── design/              디자인 시안 (페이지별 jsx + html preview)
└── HANDOFF.md           이전 세션 인계 문서
```

dev 실행: `./start.sh` (백엔드+프론트 동시 기동 + 브라우저 자동 오픈) 또는 수동으로 `npm run dev:server` / `npm run dev:web` (:3001 / :5173, /api 프록시)

---

## 파이프라인 구현 (확정)

`apps/server/src/pipeline/`에 TypeScript로 구현. 페르소나/Generator/Discriminator 프롬프트는 `apps/server/prompts/`에 vendored.

핵심 차이 (vs 셸 프로토타입):
- Step 5(자동 .tex 반영 + 오답노트 추가)를 사용자 Apply 시점으로 미룸
- Python heredoc 두 덩어리(블라인드 셔플 / 역매핑)는 TS로 합쳐서 ~150줄
- 외부 호출은 `claude --print --model X --system-prompt Y` 4번이 전부
- 구조화된 SSE 이벤트를 직접 emit해 페이지2의 stage 카드/카운터에 1:1 매핑

동시 실행은 1건만 허용 (Claude CLI 충돌 방지).

---

## 산출물 위치 (확정)

- **라운드 데이터**: `<latex_root>/refine_output/<ts>_round_NNN/{1_review.md, 2_changes.md, 2_changes.json, 3_blind_test.md, 3_mapping.txt, 4_verdict.md, decisions.json}`
- **오답노트**: `<latex_root>/refine_output/error_notes.md`
- **프로젝트 메타**: `${XDG_CONFIG_HOME:-~/.config}/paper-refine/projects.json`

라운드 데이터는 논문 리포 git에 커밋되어 결정 이력이 보존된다.

`2_changes.json`(신규)은 markdown과 별도로 구조화된 데이터를 들고 있다 — 특히 **블라인드 컨텍스트** (각 R항목별 .tex 원본의 ±N자 surrounding text)를 담는다.

---

## 사용자 결정 트랙

Discriminator의 verdict는 **추천**이고, 사용자가 R항목별로 최종 결정.
4상태: `apply` / `skip(보류)` / `reject(원문유지+사유)` / `pending(미결정)`

- "Apply selected to .tex" 버튼으로 apply 항목 일괄 반영
- reject 항목은 사유와 함께 `error_notes.md`로 누적 (다음 라운드 Generator의 학습 입력)
- 키보드: A/S/R로 결정, ←→로 R항목 이동, ↑↓로 step 점프 (예정)

---

## UX 핵심 요구사항

1. **블라인드 컨텍스트 노출** — 블라인드 A/B 카드는 후보 텍스트만 보여주지 말고
   `.tex` 원본의 ±N자 surrounding text를 회색으로 함께 렌더한다.
   사용자가 흐름 속에서 후보를 평가할 수 있어야 함.
   → 데이터 모델: `RoundItem.context.before` / `.after` (`packages/shared/src/index.ts`)
   → 추출 시점: pipeline의 generator 단계에서 .tex 매칭 후 캡처해 `2_changes.json`에 저장

2. **여정 한눈에** — page3는 Review → Changes → Blind → Verdict가 세로로 쌓이고
   사용자는 스크롤하며 "Claude는 이 과정을 거쳐 X를 골랐다. 너는?"을 한 흐름으로 본다.
   하단 sticky 결정바는 항상 시야 안.
   좌측 sticky 타임라인 레일로 step 간 점프 (예정).

---

## 데이터 포맷 (라운드 디렉토리)

| 파일 | 내용 |
|:---|:---|
| `1_review.md` | `## R1`, `## R2` 헤더로 분리. 위치/인용/지적 |
| `2_changes.md` | R항목별 "원문" / "수정" / "근거" (LaTeX 코드 블록) — 사람용 |
| `2_changes.json` | 동일 데이터 + `context.before/after` 구조화 — UI용 |
| `3_blind_test.md` | R항목별 "버전 A" / "버전 B" — 정체 가려진 LaTeX |
| `3_mapping.txt` | 라인당 `R1:A=modified,B=original` 식 역매핑 |
| `4_verdict.md` | R항목별 "선택 → A/B" + 사유/탈락 사유 + 요약 |
| `decisions.json` | R항목별 사용자 결정 (`{state, reason?, memo?, decided_at}`) |

R번호는 한 라운드 내 중복 가능(R3, R3-2). 식별은 `${r}#${occurrence}` 키로.

---

## 백엔드 API

| 엔드포인트 | 용도 |
|:---|:---|
| `GET /api/health` | 헬스체크 |
| `GET/POST/PATCH/DELETE /api/projects` | 프로젝트 CRUD (XDG config 저장) |
| `GET /api/rounds?project_id=` | 라운드 인덱스 (라운드 디렉토리 스캔) |
| `GET /api/rounds/:id` | 5파일 파싱 + decisions 머지된 라운드 상세 |
| `POST /api/rounds/run` | 파이프라인 실행 트리거 |
| `GET /api/runs/:run_id/stream` | SSE 로그 스트림 |
| `PATCH /api/rounds/:id/decisions` | R항목별 결정 저장 |
| `POST /api/rounds/:id/apply` | apply 항목 .tex 반영 + reject 항목 error_notes 추가 |

---

## 개발 메모

- 디자인 시안의 inline style을 그대로 옮긴다. CSS 변수가 실제 동작 가능한 토큰이라 마이그레이션 비용 거의 없음
- 이미 디자인에 `DiffViewer`(LCS 기반), `Stepper`, `DecisionStamp/Donut`, `PersonaBadge`, `Kbd`, `Card`가 완성돼 있음 → `apps/web/src/components/`로 옮길 때 design 코드 참조
- 페르소나 4종 + generator + discriminator 프롬프트는 `apps/server/prompts/`에 vendored. 외부 경로 의존 없음.
