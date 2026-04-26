# paper-refine — Session Handoff

이전 세션(multi-protocol-gateway 워크스페이스)에서 디자인 합의·디렉토리 셋업까지 마치고 인계.
이 문서를 첫 입력으로 읽고 이어서 진행하면 됨.

---

## 무엇을 만드는가

논문 고도화 4단계 자동 파이프라인의 **웹 워크벤치**.

```
Reviewer → Generator → [A/B 셔플] → Discriminator → 사용자 최종 결정 → .tex 반영
(1_review)  (2_changes)  (3_blind)    (4_verdict)    (decisions.json)
                                                          │
                                                  거부 사유 → error_notes.md
```

기반이 된 CLI: `~/ws/src/multi-protocol-gateway/docs/refine/refine.sh`
이 도구의 README/스크립트는 데이터 포맷 레퍼런스로 참고만. paper-refine은 그것을 외부 도구로 포팅/래핑함.

---

## 데이터 포맷 (이미 합의)

**라운드 디렉토리** — `<timestamp>_round_NNN/` 식 (예: `20260426_201636_round_001`)
한 라운드당 5개 파일:

| 파일 | 내용 |
|:---|:---|
| `1_review.md` | `## R1`, `## R2` 헤더로 분리. 위치/인용/지적 |
| `2_changes.md` | R항목별 "원문" / "수정" / "근거" (LaTeX 코드 블록) |
| `3_blind_test.md` | R항목별 "버전 A" / "버전 B" — 정체 가려진 LaTeX |
| `3_mapping.txt` | 라인당 `R1:A=modified,B=original` 식 역매핑 |
| `4_verdict.md` | R항목별 "선택→A/B" + 사유/탈락 사유 + 요약 |

**라운드 횡단**
- `error_notes.md` — 거부된 수정 사유 누적 (Generator의 다음 라운드 학습용)
- `decisions.json` (신규) — R항목별 사용자 결정: `{state: apply|skip|reject|pending, reason?, note?, decided_at}`

**파싱 규칙** — 마크다운 헤더 `## R\d+(.*)` 로 항목 분리. R번호 중복 가능(R3, R3-2 식)이라 occurrence index로 구분.

---

## 핵심 컨셉: 사용자 결정 트랙

Discriminator의 verdict는 **추천**이고, 사용자가 R항목별로 최종 결정.
4상태: `apply` / `skip(보류)` / `reject(원문유지+사유)` / `pending(미결정)`
"Apply selected to .tex" 버튼으로 apply 항목들을 .tex에 일괄 반영, reject 항목은 사유와 함께 `error_notes.md`로.
키보드 단축키: A/S/R + ←→로 R항목 이동.

---

## 페이지 구성 (디자인 시안 있음)

`design/` 폴더에 jsx 시안 + html preview 들어 있음. 다음 세션 첫 단계: 이 파일들 읽어서 톤·컴포넌트 파악.

| 파일 | 역할 |
|:---|:---|
| `paper-refine.html` | 디자인 토큰(컬러, 폰트) + 라이트/다크 |
| `components.jsx` | 공통 컴포넌트 (배지, 도장, 인용 블록 등) |
| `data.jsx` | 더미 데이터 (실제 데이터 형태 참고용) |
| `page1.jsx` | 라운드 인덱스(대시보드) |
| `page2.jsx` | 라운드 런처 (폼 + 실시간 로그) |
| `page3.jsx` | 라운드 상세 (R항목 4-step + 결정 바) |
| `page4.jsx` | 오답노트 |
| `design-canvas.jsx` | 디자인 캔버스 래퍼 (개발용) |
| `tweaks-panel.jsx` | 디자인 토큰 트윅 패널 (개발용) |

---

## 신규 요구사항: LaTeX 프로젝트 경로 지정

이전엔 multi-protocol-gateway 안에 들어있어 경로 하드코딩 가능했지만,
이제 paper-refine은 외부 도구이므로 사용자가 **타겟 LaTeX 루트**를 등록해야 함.

**프로젝트 모델:**
```ts
type Project = {
  id: string;
  name: string;          // "IEEE_ACCESS"
  latex_root: string;    // "/home/lsh/ws/src/multi-protocol-gateway/docs/paper/IEEE_ACCESS"
  sections_glob: string; // "sections/*.tex" (default)
  output_dir: string;    // "<latex_root>/refine_output" 또는 paper-refine 내부 분리
  error_notes_path: string;
};
```

- 다중 프로젝트 지원 (상단 셀렉터로 전환)
- 저장 위치 후보: `~/.config/paper-refine/projects.json` 권장
- 첫 실행 시 "프로젝트 등록" 화면. settings 페이지에서 추가/편집/삭제.
- 폴더 선택은 텍스트 입력 + 검증(존재/sections 글롭 매치 개수 미리보기)으로 충분

---

## 백엔드 API 초안

| 엔드포인트 | 용도 |
|:---|:---|
| `GET /api/projects` / `POST` / `PATCH` / `DELETE` | 프로젝트 CRUD |
| `GET /api/rounds?project_id=` | 라운드 인덱스 |
| `GET /api/rounds/:id` | 5파일 파싱 + decisions 머지된 라운드 상세 |
| `POST /api/rounds/run` | refine.sh 실행 트리거 (project_id, persona, sections, rounds, model) |
| `GET /api/runs/:run_id/stream` | SSE 로그 스트림 |
| `PATCH /api/rounds/:id/decisions` | R항목별 결정 저장 |
| `POST /api/rounds/:id/apply` | apply 항목 .tex 반영 + reject 항목 error_notes 추가 |

동시 실행은 1건만 허용 (Claude CLI 충돌 방지).

---

## 미결정 사항 (다음 세션에서 사용자에게 물어볼 것)

1. **스택**
   - 프론트: React+Vite+Tailwind / Next.js / Astro 중 어느 쪽?
   - 백엔드: Node(Fastify) / Python(FastAPI) / 또는 Tauri로 데스크톱앱?
   - 권장 default: **Vite+React+Tailwind 프론트 + Fastify 백엔드** (단순, 로컬 도구에 적합)

2. **refine.sh를 어떻게 다룰까**
   - (a) paper-refine으로 포팅 — Node/Python으로 재작성 → 외부 의존 제거
   - (b) 외부 셸 호출 — `child_process`로 sh 실행, latex_root를 인자/env로 주입
     - 단, 현재 refine.sh는 경로 하드코딩이 있을 수 있음 → paper-refine용 fork 필요 가능성
   - 권장: **(b)로 시작**, 안정화되면 (a)로 흡수

3. **decisions.json / error_notes.md 위치**
   - latex_root 옆에 둘지(논문 리포에 같이 커밋) vs paper-refine 내부 데이터(`~/.local/share/paper-refine/...`)에 둘지
   - 권장: **latex_root 옆** — 논문 리포 git에 결정 이력이 남는 게 학술적으로도 자연스러움

---

## 다음 세션 첫 단계 체크리스트

1. [ ] `design/` 파일들 읽고 톤/컴포넌트 파악 (page1~page4 위주)
2. [ ] 스택·refine.sh 처리·결정 저장 위치 사용자에게 확인
3. [ ] `git init` + `.gitignore` (node_modules, .env, runs 출력 등)
4. [ ] `package.json` (모노레포 워크스페이스 vs 단일) 결정
5. [ ] `CLAUDE.md` 작성 — 본 인계 내용을 박제
6. [ ] **프로젝트 등록 기능**(LaTeX 루트 지정)부터 → 라운드 인덱스 → 라운드 상세(결정 바 포함) → 런처 → 오답노트 순
7. [ ] `~/ws/src/multi-protocol-gateway/docs/refine/` 구조를 한 번 더 정독해서 refine.sh 동작 정확히 파악

---

## 참고 경로

- 디자인 시안: `~/ws/src/paper-refine/design/`
- 원본 CLI 도구: `~/ws/src/multi-protocol-gateway/docs/refine/`
- 샘플 라운드 출력: `~/ws/src/multi-protocol-gateway/docs/refine/output/20260426_201636_round_001/`
- 샘플 error_notes: `~/ws/src/multi-protocol-gateway/docs/refine/output/error_notes.md`
- 페르소나 4종: `prompts/reviewer_{ieee,outsider,writing,structure}.md`
- 섹션 후보(IEEE_ACCESS): `01_introduction.tex` ~ `05_conclusion.tex`

---

## 사용자 컨벤션

- 코드 수정 후 git commit용 한줄 요약 메시지 함께 제공
- 설명/문서 톤: 한국어
- 코드 식별자/태그(persona 이름 등): 영문 그대로
