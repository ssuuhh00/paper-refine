import type { Persona } from '@paper-refine/shared';

export type PersonaInfo = {
  ko: string;
  short: Persona;
  hue: number;
  desc: string;
};

export const PERSONAS: Record<Persona, PersonaInfo> = {
  ieee: { ko: 'IEEE 심사위원', short: 'ieee', hue: 232, desc: '학술적 엄밀성·서지' },
  outsider: { ko: '외부 독자', short: 'outsider', hue: 158, desc: '분야 외 가독성' },
  writing: { ko: '글쓰기 전문가', short: 'writing', hue: 28, desc: '문장·표현·흐름' },
  structure: { ko: '구조 전문가', short: 'structure', hue: 290, desc: '논리·섹션 구성' },
};

export const PERSONA_KEYS: Persona[] = ['ieee', 'outsider', 'writing', 'structure'];
