// src/lib/onboarding/types.ts
// Модель даних квізу онбордингу — див. docs/ONBOARDING_QUIZ_SPEC.md §1.

export type StepType = 'question' | 'info' | 'loader';
export type QuestionType = 'single' | 'multi' | 'number';
export type StepGroup = 'goal' | 'nutrition' | 'body' | 'finish';

export interface Option {
  value: string;
  label: string;
  description?: string; // пояснення під варіантом (патерн /diet_type)
  isNone?: boolean; // «нічого з переліченого» — знімає інші вибори
}

/** Усі предикати в масиві поєднуються через AND. */
export interface Predicate {
  field: string; // ключ у відповідях
  op: 'in' | 'notIn';
  values: string[];
}

export interface Step {
  key: string; // стабільний id: маршрут + аналітика + сховище
  type: StepType;
  group: StepGroup;
  title: string;

  /** Пояснення «навіщо питаємо». За замовчуванням видно лише новачкам. */
  hint?: string;
  hintAlways?: boolean; // показувати незалежно від nutritionKnowledge

  // --- question ---
  questionType?: QuestionType;
  field?: string; // куди пишемо у OnboardingData
  options?: Option[];
  min?: number; // для number
  max?: number;
  unit?: string; // 'см' | 'кг' | 'років'
  consent?: { text: string; href: string }; // точкова згода на екрані питання

  // --- info / loader ---
  body?: string; // основний текст
  bodyShort?: string; // варіант для «просунутих»
  variants?: Record<string, { title?: string; body?: string }>; // текст під відповідь
  variantOn?: string; // поле, від якого залежить variants
  image?: { src: string; alt: string }; // скрін застосунку (B5, B9)

  condition?: Predicate[]; // крок показується, якщо всі предикати істинні
  analyticsEvent?: string; // за замовчуванням `onboarding_${key}`
}
