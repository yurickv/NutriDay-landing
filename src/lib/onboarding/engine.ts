// src/lib/onboarding/engine.ts
// Чиста логіка квізу: видимість кроків, прогрес, навігація, verbosity.
// Жодного React/DOM — покривається юніт-тестами у node-середовищі.
import { STEPS } from './steps';
import type { Predicate, Step } from './types';

export type Answers = Record<string, unknown>;
export type Verbosity = 'beginner' | 'intermediate' | 'advanced';

function holds(p: Predicate, answers: Answers): boolean {
  const v = answers[p.field];
  const inSet = typeof v === 'string' && p.values.includes(v);
  return p.op === 'in' ? inSet : !inSet;
}

export function visibleSteps(answers: Answers): Step[] {
  return STEPS.filter((s) => (s.condition ?? []).every((p) => holds(p, answers)));
}

export function isAnswered(step: Step, answers: Answers): boolean {
  // your_profile «відповіданий», коли є email і згода — це ворота до лоадера.
  if (step.key === 'your_profile') {
    return (
      typeof answers.email === 'string' &&
      answers.email.includes('@') &&
      answers.personalDataConsent === true
    );
  }
  if (step.type !== 'question' || !step.field) return true;
  const v = answers[step.field];
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && String(v).trim() !== '';
}

/** Лічильник «ПИТАННЯ N З M» — по питаннях, інфо-екрани не нумеруються. */
export function questionProgress(
  key: string,
  answers: Answers
): { index: number; total: number } | null {
  const questions = visibleSteps(answers).filter((s) => s.type === 'question');
  const idx = questions.findIndex((s) => s.key === key);
  return idx === -1 ? null : { index: idx + 1, total: questions.length };
}

export function nextStepKey(key: string, answers: Answers): string | null {
  const visible = visibleSteps(answers);
  const i = visible.findIndex((s) => s.key === key);
  return i === -1 || i === visible.length - 1 ? null : visible[i + 1].key;
}

export function prevStepKey(key: string, answers: Answers): string | null {
  const visible = visibleSteps(answers);
  const i = visible.findIndex((s) => s.key === key);
  return i <= 0 ? null : visible[i - 1].key;
}

/** Перший невідповіданий крок; коли все заповнено — останній (лоадер). */
export function firstUnansweredKey(answers: Answers): string {
  const visible = visibleSteps(answers);
  const open = visible.find((s) => !isAnswered(s, answers));
  return open ? open.key : visible[visible.length - 1].key;
}

/** Доступні всі кроки до першого невідповіданого включно. */
export function isAccessible(key: string, answers: Answers): boolean {
  const visible = visibleSteps(answers);
  const i = visible.findIndex((s) => s.key === key);
  if (i === -1) return false;
  const gate = visible.findIndex((s) => s.key === firstUnansweredKey(answers));
  return i <= gate;
}

export function verbosity(answers: Answers): Verbosity {
  const v = answers.nutritionKnowledge;
  return v === 'intermediate' || v === 'advanced' ? v : 'beginner';
}

export function showHint(step: Step, answers: Answers): boolean {
  if (!step.hint) return false;
  return Boolean(step.hintAlways) || verbosity(answers) === 'beginner';
}

/** Титул/текст/фото інфо-екрана з урахуванням variants і bodyShort для advanced. */
export function resolveInfoContent(
  step: Step,
  answers: Answers
): { title: string; body?: string; image?: { src: string; alt: string } } {
  let title = step.title;
  let body = verbosity(answers) === 'advanced' ? step.bodyShort ?? step.body : step.body;
  let image = step.image;
  if (step.variantOn && step.variants) {
    const v = answers[step.variantOn];
    const variant = typeof v === 'string' ? step.variants[v] : undefined;
    if (variant) {
      title = variant.title ?? title;
      body = variant.body ?? body;
      image = variant.image ?? image;
    }
  }
  return { title, body, image };
}
