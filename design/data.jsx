// Dummy data for paper-refine pipeline.
// 3 rounds, IEEE Access-style Korean LaTeX paper.

const PERSONAS = {
  ieee:      { ko: 'IEEE 심사위원',  short: 'ieee',      hue: 232, desc: '학술적 엄밀성·서지' },
  outsider:  { ko: '외부 독자',      short: 'outsider',  hue: 158, desc: '분야 외 가독성' },
  writing:   { ko: '글쓰기 전문가',  short: 'writing',   hue: 28,  desc: '문장·표현·흐름' },
  structure: { ko: '구조 전문가',    short: 'structure', hue: 290, desc: '논리·섹션 구성' },
};

const SECTIONS = [
  { id: '01_introduction.tex', short: '01 서론' },
  { id: '02_related_work.tex', short: '02 관련연구' },
  { id: '03_methodology.tex',  short: '03 방법론' },
  { id: '04_experiments.tex',  short: '04 실험' },
  { id: '05_conclusion.tex',   short: '05 결론' },
];

// Round 3 (현재 작업중) — most detailed, used in page 3.
const ROUND_CURRENT = {
  id: '20260426_201636_round_003',
  ts: '2026-04-26 20:16:36',
  display: 'Round 003',
  section: '03_methodology.tex',
  persona: 'ieee',
  model: 'sonnet',
  status: 'in-progress', // 5/8 결정됨
  items: [
    {
      r: 'R1',
      title: '제안 모델의 수식 표기 일관성',
      location: 'Sec. 3.2 · L.142–151',
      cite: '본 연구에서는 입력 시퀀스를 $X = \\{x_1, x_2, \\dots, x_n\\}$로 정의하고, 어텐션 가중치를 $\\alpha_{ij}$로 표기한다. 이후 식 (4)에서 $A_{i,j}$로 표기가 바뀌며…',
      issue: '동일 변수에 대해 $\\alpha_{ij}$와 $A_{i,j}$가 혼용되고 있습니다. IEEE Access 가이드라인은 단일 논문 내 표기 일관성을 요구합니다. 또한 시퀀스 길이 $n$이 $N$으로 등장하는 부분(L.149)도 통일이 필요합니다.',
      original: `\\subsection{Attention Mechanism}
입력 시퀀스 $X = \\{x_1, x_2, \\dots, x_n\\}$에 대해 query, key, value를 산출한다.
\\begin{equation}
  \\alpha_{ij} = \\frac{\\exp(s(q_i, k_j))}{\\sum_{l=1}^{N} \\exp(s(q_i, k_l))}
\\end{equation}
이때 어텐션 행렬 $A_{i,j}$는 식 (1)의 가중치로 구성된다.`,
      modified: `\\subsection{Attention Mechanism}
입력 시퀀스 $X = \\{x_1, x_2, \\dots, x_n\\}$에 대해 query, key, value를 산출한다.
\\begin{equation}
  \\alpha_{ij} = \\frac{\\exp(s(q_i, k_j))}{\\sum_{l=1}^{n} \\exp(s(q_i, k_l))}
\\end{equation}
이때 어텐션 행렬의 원소 $\\alpha_{ij}$는 식 (1)의 정의를 그대로 사용한다.`,
      rationale: '시퀀스 길이를 $n$으로, 어텐션 가중치를 $\\alpha_{ij}$로 통일. 새 기호 $A_{i,j}$ 도입을 제거하여 독자가 식 (4)·(7)을 추적할 때 인지 부담을 줄임.',
      blind: { A: 'modified', B: 'original' },
      verdict: { pick: 'A', reason: '표기 통일이 명확하며, 식 (1)의 결과를 본문에서 그대로 재사용하는 흐름이 더 자연스럽다. B는 새 기호를 도입한 뒤 다시 정의하지 않아 후속 식에서 모호함을 야기할 수 있음.', loserReason: '단일 변수에 대해 두 표기를 도입함은 IEEE Access 일관성 원칙에 부합하지 않는다.' },
      decision: 'apply',
      memo: '식 (4), (7)도 동일하게 $\\alpha$로 통일 필요 — 다음 라운드에서 처리.',
    },
    {
      r: 'R2',
      title: '복잡도 분석의 점근 표기 누락',
      location: 'Sec. 3.4 · L.198–203',
      cite: '본 알고리즘의 시간 복잡도는 $n^2 d$이며, 공간 복잡도는 $n d$이다.',
      issue: 'Big-O 표기 없이 raw expression만 기술되어 있어 점근적 상한인지 정확한 비용인지 불명확합니다. 또한 $d$의 정의(임베딩 차원)가 본문에 다시 나타나야 합니다.',
      original: `본 알고리즘의 시간 복잡도는 $n^2 d$이며, 공간 복잡도는 $n d$이다.
이는 표준 트랜스포머와 동일한 수준이다.`,
      modified: `본 알고리즘의 시간 복잡도는 $\\mathcal{O}(n^2 d)$, 공간 복잡도는 $\\mathcal{O}(n d)$이다 (여기서 $n$은 시퀀스 길이, $d$는 임베딩 차원).
이는 표준 Transformer~\\cite{vaswani2017} 대비 동일한 점근 비용으로, 추가 파라미터 없이 정확도 향상을 이룬다.`,
      rationale: 'Big-O 표기 추가, 변수 정의 재명시, 비교 대상 인용 추가. "표준 트랜스포머"라는 모호한 표현을 \\cite로 명확화.',
      blind: { A: 'original', B: 'modified' },
      verdict: { pick: 'B', reason: '점근 표기와 변수 정의가 명시적이고, 비교 기준이 인용으로 뒷받침된다. 학술 논문에서 복잡도 진술의 표준 형식에 부합.', loserReason: 'raw expression만으로는 상한·하한·정확치 중 무엇인지 구분되지 않음.' },
      decision: 'apply',
      memo: '',
    },
    {
      r: 'R3',
      title: '하이퍼파라미터 표 누락',
      location: 'Sec. 3.5 · L.221',
      cite: '학습률은 $5 \\times 10^{-5}$, 배치 크기는 32, 에폭은 50으로 설정하였다.',
      issue: '하이퍼파라미터가 본문에 나열되어 있어 재현성이 떨어집니다. IEEE Access는 핵심 하이퍼파라미터를 표로 정리할 것을 권장합니다.',
      original: `학습률은 $5 \\times 10^{-5}$, 배치 크기는 32, 에폭은 50으로 설정하였다. 옵티마이저는 AdamW, weight decay는 0.01을 사용하였다.`,
      modified: `학습 설정은 표~\\ref{tab:hparams}에 정리하였다.
\\begin{table}[h]
\\centering
\\caption{학습 하이퍼파라미터}
\\label{tab:hparams}
\\begin{tabular}{ll}
\\hline
Optimizer & AdamW \\\\
Learning rate & $5 \\times 10^{-5}$ \\\\
Batch size & 32 \\\\
Epochs & 50 \\\\
Weight decay & 0.01 \\\\
\\hline
\\end{tabular}
\\end{table}`,
      rationale: '본문 나열을 표로 변환. \\ref/\\label 추가로 재현성과 가독성을 동시 개선.',
      blind: { A: 'modified', B: 'original' },
      verdict: { pick: 'A', reason: '표 형식이 재현성 측면에서 우월하며, IEEE Access 가이드와 부합한다.', loserReason: '본문 나열은 항목 추가 시 가독성이 빠르게 저하됨.' },
      decision: 'apply',
      memo: '표 위치는 컬럼 구분에 영향 받음 — 컴파일 후 확인.',
    },
    {
      r: 'R4',
      title: '데이터셋 분할 비율 명시 부족',
      location: 'Sec. 3.3 · L.175',
      cite: '데이터셋을 학습/검증/테스트로 분할하였다.',
      issue: '구체적 분할 비율(예: 8:1:1)이 누락되어 재현이 불가능합니다. 시드 값도 함께 명시 필요.',
      original: `데이터셋을 학습/검증/테스트로 분할하였다. 분할은 무작위로 수행되었다.`,
      modified: `데이터셋은 학습:검증:테스트 = 8:1:1 비율로 분할하였으며, 무작위 시드를 \\texttt{seed=42}로 고정하여 재현성을 보장하였다. 클래스 분포는 stratified sampling으로 유지하였다.`,
      rationale: '분할 비율 수치화, 시드 고정 명시, stratified sampling 정보 추가.',
      blind: { A: 'modified', B: 'original' },
      verdict: { pick: 'A', reason: '재현성에 필요한 모든 정보가 한 문장에 응축되어 있음.', loserReason: '"무작위" 표현만으로는 외부 재현이 사실상 불가.' },
      decision: 'pending',
      memo: '',
    },
    {
      r: 'R5',
      title: '평가 지표 정의 부재',
      location: 'Sec. 3.6 · L.245',
      cite: 'F1-score와 accuracy를 사용하여 평가하였다.',
      issue: '다중 클래스 환경에서 F1의 평균 방식(macro/micro/weighted)을 명시해야 합니다.',
      original: `F1-score와 accuracy를 사용하여 평가하였다.`,
      modified: `평가 지표로 macro-averaged F1-score, weighted F1-score, accuracy를 사용하였다. 클래스 불균형이 존재하므로 macro F1을 주된 지표로 보고한다.`,
      rationale: 'F1 평균 방식 명시, 주 지표 선언, 불균형 데이터에 대한 정당화.',
      blind: { A: 'original', B: 'modified' },
      verdict: { pick: 'B', reason: '주 지표를 명시하고 그 선택의 근거를 제시함. 심사 단계에서 자주 지적되는 약점을 선제 차단.', loserReason: '단순 나열은 어떤 지표를 우선해야 할지 불명확.' },
      decision: 'pending',
      memo: '',
    },
    {
      r: 'R6',
      title: '알고리즘 의사코드의 입출력 명시',
      location: 'Sec. 3.2 · Algorithm 1',
      cite: '\\begin{algorithm}\\caption{Proposed method}\\begin{algorithmic}[1]\\STATE Initialize…',
      issue: 'Algorithm 1에 \\textbf{Input}, \\textbf{Output} 구문이 누락되었습니다. IEEE Access는 의사코드의 입출력 명시를 요구합니다.',
      original: `\\begin{algorithm}
\\caption{Proposed method}
\\begin{algorithmic}[1]
\\STATE Initialize $\\theta$
\\FOR{$t = 1$ to $T$}
  \\STATE Sample batch
  \\STATE Update $\\theta$
\\ENDFOR
\\end{algorithmic}
\\end{algorithm}`,
      modified: `\\begin{algorithm}
\\caption{Proposed method}
\\label{alg:main}
\\begin{algorithmic}[1]
\\REQUIRE Dataset $\\mathcal{D}$, learning rate $\\eta$, epochs $T$
\\ENSURE Trained parameters $\\theta^*$
\\STATE Initialize $\\theta_0$
\\FOR{$t = 1$ to $T$}
  \\STATE Sample mini-batch $B \\subset \\mathcal{D}$
  \\STATE $\\theta_t \\leftarrow \\theta_{t-1} - \\eta \\nabla \\mathcal{L}(\\theta_{t-1}; B)$
\\ENDFOR
\\STATE \\RETURN $\\theta_T$
\\end{algorithmic}
\\end{algorithm}`,
      rationale: 'REQUIRE/ENSURE 추가, 업데이트 식을 명시화, 라벨 부여.',
      blind: { A: 'modified', B: 'original' },
      verdict: { pick: 'A', reason: '입출력과 핵심 업데이트가 명시되어 알고리즘 자체로 재구현 가능.', loserReason: '"Update $\\theta$"는 너무 추상적이어서 의사코드의 가치를 잃음.' },
      decision: 'reject',
      rejectReason: '알고리즘 박스가 컬럼 폭을 초과해 컴파일 에러. 다음 라운드에서 \\algorithm*로 변경 후 재시도.',
      memo: '',
    },
    {
      r: 'R7',
      title: '손실 함수의 가중치 표기',
      location: 'Sec. 3.4 · Eq. (6)',
      cite: '$\\mathcal{L} = \\mathcal{L}_{ce} + \\lambda \\mathcal{L}_{reg}$',
      issue: '$\\lambda$의 값과 선정 근거가 본문에 없습니다. ablation을 통해 결정된 값임을 명시 필요.',
      original: `최종 손실은 $\\mathcal{L} = \\mathcal{L}_{ce} + \\lambda \\mathcal{L}_{reg}$로 정의된다.`,
      modified: `최종 손실은 $\\mathcal{L} = \\mathcal{L}_{ce} + \\lambda \\mathcal{L}_{reg}$로 정의되며, $\\lambda = 0.1$은 검증 셋에서 grid search($\\{0.01, 0.05, 0.1, 0.5, 1.0\\}$)를 통해 선정하였다 (Sec.~\\ref{sec:ablation} 참조).`,
      rationale: '$\\lambda$ 값, 탐색 범위, 결정 방법, 관련 섹션 인용을 한 문장에 통합.',
      blind: { A: 'original', B: 'modified' },
      verdict: { pick: 'B', reason: '하이퍼파라미터 결정 과정의 투명성을 높임.', loserReason: '값과 근거 누락은 cherry-picking 의심을 살 수 있음.' },
      decision: 'skip',
      memo: 'ablation 섹션이 아직 미작성 — 그 섹션 작성 후 함께 반영.',
    },
    {
      r: 'R8',
      title: '문단 시작의 접속어 과다',
      location: 'Sec. 3.1 · L.118, L.124, L.131',
      cite: '"또한 ~", "한편 ~", "따라서 ~"가 연속 문단 시작에 사용됨',
      issue: 'IEEE 학술 논문에서 문단 첫 단어로 접속부사를 반복 사용하면 단조롭게 읽힙니다. 글쓰기 페르소나 관점에서 다양화 권장.',
      original: `또한 본 절에서는 모델의 전체 구조를 설명한다. … 한편 인코더는 6개 층으로 구성된다. … 따라서 디코더 또한 6개 층을 사용한다.`,
      modified: `본 절에서는 모델의 전체 구조를 설명한다. … 인코더는 6개 층으로 구성되며, 각 층은 self-attention과 feed-forward로 이루어진다. … 디코더 또한 동일한 6개 층 구조를 채택하되, cross-attention 모듈을 추가하였다.`,
      rationale: '접속부사 제거 + 각 문단의 정보량 보강. 단순 문체 수정이 아니라 내용을 더 단단히 함.',
      blind: { A: 'modified', B: 'original' },
      verdict: { pick: 'A', reason: '문단 도입부의 단조로움이 제거되었고, 각 문단이 독립적 정보 단위로 강화됨.', loserReason: '접속부사 반복은 학술적 톤을 약화시킴.' },
      decision: 'pending',
      memo: '',
    },
  ],
};

// Past rounds — lighter detail.
const ROUND_002 = {
  id: '20260425_143020_round_002',
  ts: '2026-04-25 14:30:20',
  display: 'Round 002',
  section: '02_related_work.tex',
  persona: 'structure',
  model: 'sonnet',
  status: 'completed',
  itemCount: 6,
  decisions: { apply: 4, skip: 1, reject: 1, pending: 0 },
  recommendation: { modified: 5, original: 1 },
};

const ROUND_001 = {
  id: '20260424_091245_round_001',
  ts: '2026-04-24 09:12:45',
  display: 'Round 001',
  section: '01_introduction.tex',
  persona: 'outsider',
  model: 'opus',
  status: 'completed',
  itemCount: 9,
  decisions: { apply: 6, skip: 2, reject: 1, pending: 0 },
  recommendation: { modified: 7, original: 2 },
};

// 오답노트 누적
const ERROR_NOTES = [
  { round: '003', r: 'R6', section: '03_methodology.tex', persona: 'ieee', source: 'user', date: '2026-04-26', reason: '알고리즘 박스가 컬럼 폭을 초과해 컴파일 에러. 다음 라운드에서 \\algorithm*로 변경 후 재시도.', title: '알고리즘 의사코드의 입출력 명시' },
  { round: '002', r: 'R3', section: '02_related_work.tex', persona: 'structure', source: 'discriminator', date: '2026-04-25', reason: '제안한 재배치가 시간 순서를 깨뜨림. 발표 연도 기준 정렬을 유지해야 함.', title: '관련연구 단락 순서 재배치' },
  { round: '002', r: 'R5', section: '02_related_work.tex', persona: 'structure', source: 'user', date: '2026-04-25', reason: '인용 추가는 적절하나, 본문 길이 제한(8 페이지)을 초과할 우려.', title: '경쟁 연구 비교표 신설' },
  { round: '001', r: 'R7', section: '01_introduction.tex', persona: 'outsider', source: 'discriminator', date: '2026-04-24', reason: '제안 도입 문단이 contribution을 흐림. 원문이 더 직접적임.', title: '도입부 일화 추가' },
  { round: '001', r: 'R2', section: '01_introduction.tex', persona: 'outsider', source: 'user', date: '2026-04-24', reason: 'IEEE Access 형식상 contribution은 bullet으로 강조하는 관행 유지가 안전.', title: 'contribution bullet → 산문화' },
];

const ROUNDS_ALL = [ROUND_CURRENT, ROUND_002, ROUND_001];

window.PAPER_DATA = { PERSONAS, SECTIONS, ROUND_CURRENT, ROUND_002, ROUND_001, ROUNDS_ALL, ERROR_NOTES };
