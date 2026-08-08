# Новий онбординг-квіз — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Замінити 18 сторінок старого онбордингу на data-driven квіз `/onboarding/[step]` за спекою [docs/ONBOARDING_QUIZ_SPEC.md](../../ONBOARDING_QUIZ_SPEC.md) у стилі бренд-буку NutriDay.

**Architecture:** Увесь флоу описаний масивом `STEPS: Step[]` (`src/lib/onboarding/steps.ts`); чистий двигун (`engine.ts`) рахує видимі кроки, прогрес і навігацію; один динамічний маршрут `/onboarding/[step]` рендерить крок через `StepRenderer`. Сховище відповідей — без змін (`localStorage.onboardingData` через `onboardingHelpers.ts`).

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS 4 (@theme токени вже в globals.css), Vitest (node env), lucide-react.

## Global Constraints

- **Токени тільки з globals.css** — `sage/-dark/-light`, `terracotta/-dark/-light`, `ink`, `cream`, `card`, `night`, `night-card`, `night-ink`, `night-muted`, `danger`, `danger-dark`, `shadow-soft`, `font-heading`, `font-body`. **Нових hex не вводимо.** Пропорція ~60% крем / 30% sage / 10% terracotta (terracotta = тільки CTA й акцентне число).
- **Темна тема** — через клас `.dark` (варіант `dark:`), пари: `bg-cream ↔ dark:bg-night`, `bg-card ↔ dark:bg-night-card`, `text-ink ↔ dark:text-night-ink`, `text-ink/60 ↔ dark:text-night-muted`.
- **Українські тексти копіюються зі спеки дослівно** (заголовки, підписи, варіанти). Звертання на «ти».
- **Ключі значень** = існуючі канонічні: `mainGoal`/`shortGoal` ключі як у `GOAL_FACTORS`/`SHORT_GOAL_LABELS`; `sex` = `female`/`male` (нове, `normalizeSex()` уже приймає); `dietaryPreferences` значення дослівно з `FoodPreferencesEditor.tsx` (`'вегетаріанське'` тощо); `activity` = рядки `'1.2'…'1.9'`. Числа (вік/зріст/вага) зберігаються **рядками** — `calcProfile` робить `parseFloat`.
- **Vitest**: `environment: 'node'`, include `src/**/*.test.ts`, **без alias `@/`** — тести й `src/lib/onboarding/*` між собою імпортуються відносними шляхами (`./types`, `./steps`). `@/lib/calories` імпортувати в `src/lib/onboarding/summary.ts` як `../calories` (відносно), щоб тест працював.
- **НЕ запускати `next build`, поки працює `next dev`** (ламає `.next/` — 500 на всіх роутах). Перевірка типів: `npx tsc --noEmit`.
- Команди в прикладах — PowerShell (Windows). Коміти — з `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `/api/menu/preview` — **поза цим планом**: крок D3 (лоадер) працює з фіксованою тривалістю і редіректить на `/payment/plan`; крок D4 (`menu_preview`) **не додається** в STEPS (додасться окремою задачею разом із preview-ендпоінтом).
- Асети-блокери (фото експерта, скріни B5/B9) — код має **граційний фолбек** (placeholder), очікувані шляхи: `public/onboarding/expert.jpg`, `public/onboarding/day-demo.png`, `public/onboarding/kbju-demo.png`.

---

### Task 1: Типи кроків + нові поля OnboardingData

**Files:**
- Create: `src/lib/onboarding/types.ts`
- Modify: `src/types/onboarding.ts`

**Interfaces:**
- Consumes: нічого.
- Produces: типи `Step`, `Option`, `Predicate`, `StepType`, `QuestionType`, `StepGroup` (використовують Task 2–7); розширений `OnboardingData` (нові поля; **старі поля видаляються тільки в Task 9**, бо їх ще читають старі сторінки й payment-сторінка).

- [ ] **Step 1: Створити `src/lib/onboarding/types.ts`**

```ts
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
```

- [ ] **Step 2: Додати нові поля в `src/types/onboarding.ts`** (старі НЕ чіпати — видалення в Task 9)

```ts
export interface OnboardingData {
  mainGoal?: string;
  goalReason?: string;
  shortGoal?: string[];
  nutritionKnowledge?: string;
  shortBarriers?: string[];
  additionalGoal?: string[];
  buildMuscleExperience?: string;
  pastExperience?: string;
  gainWeightExperience?: string;
  pastChallenges?: string[];
  roleModel?: string;
  // From CaloriesCalc
  sex?: string;
  age?: string;
  weight?: string;
  height?: string;
  activity?: string;
  // Contact
  email?: string;
  // Новий квіз (docs/ONBOARDING_QUIZ_SPEC.md §2, §6)
  targetWeight?: string;
  breakfastTime?: string;
  lunchTime?: string;
  dinnerTime?: string;
  dietaryPreferences?: string[];
  eatingHabits?: string[];
  cravings?: string[];
  foodTracking?: string;
  mealsPerDay?: string;
  batchCooking?: string;
  confidence?: string;
  personalDataConsent?: boolean;
}
```

- [ ] **Step 3: Перевірити типи**

Run: `npx tsc --noEmit`
Expected: exit 0, без помилок.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/onboarding/types.ts src/types/onboarding.ts
git commit -m @'
feat(onboarding): quiz step data model + new OnboardingData fields

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 2: STEPS — увесь флоу даними (+ тести)

**Files:**
- Create: `src/lib/onboarding/steps.ts`
- Test: `src/lib/onboarding/steps.test.ts`

**Interfaces:**
- Consumes: типи з `./types` (Task 1).
- Produces: `STEPS: Step[]`; `getStep(key: string): Step | undefined`; `plainLabel(label: string): string` (зрізає емодзі-префікс); `labelFor(field: string, value: string): string` — підпис без емодзі, єдине джерело правди для `/payment/plan` (Task 8).

- [ ] **Step 1: Написати падаючий тест `src/lib/onboarding/steps.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { STEPS, getStep, labelFor, plainLabel } from './steps';

// Канон значень із src/components/profilePage/FoodPreferencesEditor.tsx —
// щоб dietaryPreferences лягли в профіль без мапінгу.
const DIETARY_CANON = [
  'вегетаріанське',
  'веганське',
  'кето',
  'без глютену',
  'без молочних',
  'без свинини',
  'без морепродуктів',
  'без цукру',
];

describe('STEPS integrity', () => {
  it('has unique keys', () => {
    const keys = STEPS.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every question has a field and inputs config', () => {
    for (const s of STEPS.filter((x) => x.type === 'question')) {
      expect(s.field, s.key).toBeTruthy();
      expect(s.questionType, s.key).toBeTruthy();
      if (s.questionType === 'number') {
        expect(s.min, s.key).toBeTypeOf('number');
        expect(s.max, s.key).toBeTypeOf('number');
        expect(s.unit, s.key).toBeTruthy();
      } else {
        expect(s.options?.length, s.key).toBeGreaterThan(1);
      }
    }
  });

  it('starts with gender and ends with the loader', () => {
    expect(STEPS[0].key).toBe('gender');
    expect(STEPS[STEPS.length - 1]).toMatchObject({ key: 'analyzing', type: 'loader' });
  });

  it('diet_type values match the profile editor canon', () => {
    const step = getStep('diet_type')!;
    const values = step.options!.filter((o) => !o.isNone).map((o) => o.value);
    expect(values).toEqual(DIETARY_CANON);
    expect(step.options![0].isNone).toBe(true); // «Їм усе» першим
  });

  it('sex options are canonical male/female', () => {
    const values = getStep('gender')!.options!.map((o) => o.value);
    expect(values).toEqual(['female', 'male']);
  });

  it('target_weight is conditional on mainGoal', () => {
    expect(getStep('target_weight')!.condition).toEqual([
      { field: 'mainGoal', op: 'in', values: ['lose_weight', 'gain_weight', 'build_muscle'] },
    ]);
  });

  it('goal_promise has a variant for every main goal', () => {
    const goals = getStep('main_goal')!.options!.map((o) => o.value);
    const variants = Object.keys(getStep('goal_promise')!.variants!);
    expect(variants.sort()).toEqual([...goals].sort());
  });

  it('labelFor strips emoji and falls back to the raw value', () => {
    expect(plainLabel('📉 Схуднути')).toBe('Схуднути');
    expect(labelFor('mainGoal', 'lose_weight')).toBe('Схуднути');
    expect(labelFor('shortGoal', 'meal_planning')).toBe('Не думати що приготувати завтра');
    expect(labelFor('mainGoal', 'unknown_key')).toBe('unknown_key');
  });
});
```

- [ ] **Step 2: Переконатися, що тест падає**

Run: `npx vitest run src/lib/onboarding/steps.test.ts`
Expected: FAIL — `Cannot find module './steps'`.

- [ ] **Step 3: Створити `src/lib/onboarding/steps.ts`** (тексти — дослівно зі спеки)

```ts
// src/lib/onboarding/steps.ts
// Увесь флоу онбордингу як дані. Порядок масиву = порядок екранів.
// Тексти — з docs/ONBOARDING_QUIZ_SPEC.md §2; змінюючи копірайт, зважай,
// що labelFor() читають і сторінка оплати, і аналітика.
import type { Step } from './types';

export const STEPS: Step[] = [
  // ── Група A · Мета ─────────────────────────────────────────────
  {
    key: 'gender',
    type: 'question',
    group: 'goal',
    title: 'Для кого складаємо меню?',
    hint: 'Норма калорій у жінок і чоловіків рахується за різними формулами.',
    questionType: 'single',
    field: 'sex',
    options: [
      { value: 'female', label: '👩 Жінка' },
      { value: 'male', label: '👨 Чоловік' },
    ],
  },
  {
    key: 'main_goal',
    type: 'question',
    group: 'goal',
    title: 'Яка твоя головна ціль?',
    questionType: 'single',
    field: 'mainGoal',
    options: [
      { value: 'lose_weight', label: '📉 Схуднути' },
      { value: 'maintain_weight', label: '⚖️ Підтримати вагу' },
      { value: 'build_muscle', label: "💪 Наростити м'язи" },
      { value: 'gain_weight', label: '📈 Набрати вагу' },
      { value: 'something_else', label: '🍽️ Просто харчуватись краще' },
    ],
  },
  {
    key: 'goal_promise',
    type: 'info',
    group: 'goal',
    title: 'Твій план уже вимальовується',
    variantOn: 'mainGoal',
    variants: {
      lose_weight: {
        title: 'Схуднути можна без голоду',
        body: 'Складемо меню з невеликим дефіцитом — худнутимеш у своєму темпі й без відмови від улюбленої їжі.',
      },
      maintain_weight: {
        title: 'Тримати вагу — найпростіше',
        body: 'Меню рівно на твою норму. Нічого рахувати вручну.',
      },
      build_muscle: {
        title: "М'язи ростуть на їжі",
        body: 'Порахуємо норму з профіцитом і достатнім білком — тобі лишиться готувати.',
      },
      gain_weight: {
        title: 'Набрати вагу теж треба з розумом',
        body: 'Не «їж усе підряд», а спокійний профіцит на нормальній їжі.',
      },
      something_else: {
        title: 'Просто їсти краще — теж ціль',
        body: 'Меню на твою норму, різноманітне й без складних правил.',
      },
    },
  },
  {
    key: 'nutrition_knowledge',
    type: 'question',
    group: 'goal',
    title: 'Наскільки ти розбираєшся в харчуванні?',
    questionType: 'single',
    field: 'nutritionKnowledge',
    options: [
      { value: 'beginner', label: '🌱 Тільки починаю — поясніть мені все' },
      { value: 'intermediate', label: '🙂 Дещо знаю, хочу системності' },
      { value: 'advanced', label: '😎 Розбираюсь, треба лише зручний інструмент' },
    ],
  },
  {
    key: 'short_goal',
    type: 'question',
    group: 'goal',
    title: 'Що ще хочеш отримати?',
    questionType: 'multi',
    field: 'shortGoal',
    options: [
      { value: 'balanced_eating', label: '🥗 Збалансовано харчуватися і жити здоровіше' },
      { value: 'boost_energy', label: '⚡ Підвищити енергію і настрій' },
      { value: 'stay_motivated', label: '🎯 Залишатися мотивованим і послідовним' },
      { value: 'better_body_image', label: '💚 Краще ставитися до свого тіла' },
      { value: 'meal_planning', label: '🗓️ Не думати що приготувати завтра' },
    ],
  },

  // ── Група B · Харчування ───────────────────────────────────────
  {
    key: 'breakfast_time',
    type: 'question',
    group: 'nutrition',
    title: 'Коли ти зазвичай снідаєш?',
    hint: 'Підлаштуємо розмір порцій під твій ритм дня.',
    questionType: 'single',
    field: 'breakfastTime',
    options: [
      { value: '06_08', label: 'Між 6:00 і 8:00' },
      { value: '08_10', label: 'Між 8:00 і 10:00' },
      { value: '10_12', label: 'Між 10:00 і 12:00' },
      { value: 'skip', label: 'Зазвичай пропускаю сніданок' },
    ],
  },
  {
    key: 'lunch_time',
    type: 'question',
    group: 'nutrition',
    title: 'А обідаєш?',
    questionType: 'single',
    field: 'lunchTime',
    options: [
      { value: '10_12', label: 'Між 10:00 і 12:00' },
      { value: '12_14', label: 'Між 12:00 і 14:00' },
      { value: '14_16', label: 'Між 14:00 і 16:00' },
      { value: 'skip', label: 'Зазвичай пропускаю обід' },
    ],
  },
  {
    key: 'dinner_time',
    type: 'question',
    group: 'nutrition',
    title: 'О котрій вечеряєш?',
    questionType: 'single',
    field: 'dinnerTime',
    options: [
      { value: '16_18', label: 'Між 16:00 і 18:00' },
      { value: '18_20', label: 'Між 18:00 і 20:00' },
      { value: '20_22', label: 'Між 20:00 і 22:00' },
      { value: 'skip', label: 'Зазвичай пропускаю вечерю' },
    ],
  },
  {
    key: 'diet_type',
    type: 'question',
    group: 'nutrition',
    title: 'Який тип харчування тобі ближчий?',
    hint: 'Те, що ти виключиш, ніколи не потрапить у твоє меню.',
    hintAlways: true,
    questionType: 'multi',
    field: 'dietaryPreferences',
    options: [
      { value: 'none', label: '🍽️ Їм усе', description: 'Без обмежень', isNone: true },
      { value: 'вегетаріанське', label: '🥗 Вегетаріанське', description: "Без м'яса і риби" },
      { value: 'веганське', label: '🌱 Веганське', description: 'Без продуктів тваринного походження' },
      { value: 'кето', label: '🥑 Кето', description: 'Мало вуглеводів, більше жирів' },
      { value: 'без глютену', label: '🌾 Без глютену', description: 'Без пшениці, жита, ячменю' },
      { value: 'без молочних', label: '🥛 Без молочних', description: 'Без молока, сиру, йогурту' },
      { value: 'без свинини', label: '🐷 Без свинини' },
      { value: 'без морепродуктів', label: '🦐 Без морепродуктів' },
      { value: 'без цукру', label: '🍬 Без цукру', description: 'Без доданого цукру' },
    ],
  },
  {
    key: 'meal_card_demo',
    type: 'info',
    group: 'nutrition',
    title: 'Ось як виглядатиме твій день',
    body: 'Готове меню на день: страви, калорії та БЖВ — усе вже пораховано.',
    image: { src: '/onboarding/day-demo.png', alt: 'Скрін меню на день у застосунку' },
  },
  {
    key: 'eating_habits',
    type: 'question',
    group: 'nutrition',
    title: 'Чи є в тебе такі звички?',
    questionType: 'multi',
    field: 'eatingHabits',
    options: [
      { value: 'emotional_eating', label: 'Заїдаю емоції або нудьгу' },
      { value: 'overeating', label: 'Переїдаю' },
      { value: 'late_snacking', label: 'Перекушую пізно ввечері' },
      { value: 'skipping_meals', label: 'Часто пропускаю прийоми їжі' },
      { value: 'none', label: 'Нічого з переліченого', isNone: true },
    ],
  },
  {
    key: 'cravings',
    type: 'question',
    group: 'nutrition',
    title: 'За чим тягне найчастіше?',
    questionType: 'multi',
    field: 'cravings',
    options: [
      { value: 'sweets', label: '🍫 Солодке' },
      { value: 'salty_snacks', label: '🥨 Солоні снеки' },
      { value: 'fast_food', label: '🍔 Фастфуд' },
      { value: 'soda', label: '🥤 Газована вода' },
      { value: 'none', label: 'Нічого з переліченого', isNone: true },
    ],
  },
  {
    key: 'food_tracking',
    type: 'question',
    group: 'nutrition',
    title: "Чи ведеш облік того, що з'їдаєш?",
    questionType: 'single',
    field: 'foodTracking',
    options: [
      { value: 'always', label: 'Так, записую кожен прийом' },
      { value: 'sometimes', label: 'Іноді, коли згадаю' },
      { value: 'never', label: 'Ні, ніколи' },
    ],
  },
  {
    key: 'calories_done_for_you',
    type: 'info',
    group: 'nutrition',
    title: 'КБЖУ порахуємо за тебе',
    body: 'Не треба зважувати й рахувати вручну — калорії та БЖВ рахуються автоматично з інгредієнтів кожної страви.',
    bodyShort: 'Калорії та БЖВ рахуються автоматично з інгредієнтів кожної страви.',
    image: { src: '/onboarding/kbju-demo.png', alt: 'Скрін підрахованих КБЖУ в застосунку' },
  },
  {
    key: 'meals_per_day',
    type: 'question',
    group: 'nutrition',
    title: 'Скільки прийомів їжі на день тобі комфортно?',
    questionType: 'single',
    field: 'mealsPerDay',
    options: [
      { value: 'under_3', label: 'Менше 3' },
      { value: 'three', label: '3 прийоми' },
      { value: 'three_plus_snacks', label: '3 прийоми і перекуси' },
      { value: 'depends', label: 'Залежить від дня' },
    ],
  },
  {
    key: 'no_giving_up',
    type: 'info',
    group: 'nutrition',
    title: 'Хочеться піци? Впишемо її в меню разом',
    body: "Меню — це смачний спосіб життя, а не покарання за з'їдене. Улюблені страви лишаються — ми лише вписуємо їх у твою норму.",
    bodyShort: 'Улюблені страви лишаються — ми лише вписуємо їх у твою норму.',
  },
  {
    key: 'batch_cooking',
    type: 'question',
    group: 'nutrition',
    title: 'Чи любиш готувати одразу на кілька днів?',
    hint: 'Якщо так — плануватимемо страви, яких вистачає на 2-3 дні.',
    questionType: 'single',
    field: 'batchCooking',
    options: [
      { value: 'yes', label: 'Так, готую наперед' },
      { value: 'sometimes', label: 'Іноді' },
      { value: 'no', label: 'Ні, готую щодня' },
    ],
  },
  {
    key: 'expert',
    type: 'info',
    group: 'nutrition',
    title: 'Плани складає практик, а не алгоритм наосліп',
  },

  // ── Група C · Тіло ─────────────────────────────────────────────
  {
    key: 'height',
    type: 'question',
    group: 'body',
    title: 'Який у тебе зріст?',
    questionType: 'number',
    field: 'height',
    min: 100,
    max: 220,
    unit: 'см',
  },
  {
    key: 'current_weight',
    type: 'question',
    group: 'body',
    title: 'Яка твоя поточна вага?',
    hint: 'Потрібна тільки для розрахунку норми. Ніде не показується публічно.',
    hintAlways: true,
    questionType: 'number',
    field: 'weight',
    min: 40,
    max: 130,
    unit: 'кг',
  },
  {
    key: 'target_weight',
    type: 'question',
    group: 'body',
    title: 'А яка вага для тебе комфортна?',
    questionType: 'number',
    field: 'targetWeight',
    min: 40,
    max: 130,
    unit: 'кг',
    condition: [
      { field: 'mainGoal', op: 'in', values: ['lose_weight', 'gain_weight', 'build_muscle'] },
    ],
  },
  {
    key: 'age',
    type: 'question',
    group: 'body',
    title: 'Скільки тобі років?',
    questionType: 'number',
    field: 'age',
    min: 14,
    max: 130,
    unit: 'років',
  },
  {
    key: 'activity',
    type: 'question',
    group: 'body',
    title: 'Наскільки активний твій день?',
    questionType: 'single',
    field: 'activity',
    options: [
      { value: '1.2', label: '🪑 Переважно сиджу', description: 'Офісна робота, мало руху' },
      { value: '1.375', label: '🧍 Переважно стою', description: 'Вчитель, продавець-консультант' },
      { value: '1.55', label: '🚶 Багато ходжу', description: "Кур'єр, офіціант, активний день" },
      { value: '1.725', label: '🏗️ Фізично важка робота', description: 'Будівництво, склад' },
      { value: '1.9', label: '🏋️ Дуже інтенсивні навантаження', description: 'Щоденні тренування або важка фізична праця' },
    ],
  },
  {
    key: 'how_we_count',
    type: 'info',
    group: 'body',
    title: 'Ось як ми рахуємо твою норму',
  },

  // ── Група D · Фініш ────────────────────────────────────────────
  {
    key: 'confidence',
    type: 'question',
    group: 'finish',
    title: 'Наскільки ти впевнений, що дійдеш до цілі?',
    questionType: 'single',
    field: 'confidence',
    options: [
      { value: 'sure', label: '💪 Вірю, що впораюсь' },
      { value: 'willing', label: '🙂 Не впевнений, але спробую' },
      { value: 'doubt', label: '😕 Чесно — сумніваюсь' },
    ],
  },
  {
    key: 'your_profile',
    type: 'info',
    group: 'finish',
    title: 'Твій профіль готовий',
    consent: {
      text: 'Я надаю згоду на обробку моїх персональних даних',
      href: '/oferta',
    },
  },
  {
    key: 'analyzing',
    type: 'loader',
    group: 'finish',
    title: 'Складаємо твій план…',
  },
  // D4 (menu_preview) додасться окремою задачею разом з /api/menu/preview —
  // див. спеку §7 п.5. До того лоадер веде одразу на /payment/plan.
];

export function getStep(key: string): Step | undefined {
  return STEPS.find((s) => s.key === key);
}

// «📉 Схуднути» → «Схуднути»: зрізає провідні не-літери (емодзі + пробіли).
const EMOJI_PREFIX = /^[^\p{L}\p{N}]+\s*/u;

export function plainLabel(label: string): string {
  return label.replace(EMOJI_PREFIX, '');
}

/**
 * Підпис відповіді без емодзі за полем і значенням. Єдине джерело правди
 * для сторінки оплати замість дубльованих таблиць лейблів.
 */
export function labelFor(field: string, value: string): string {
  for (const step of STEPS) {
    if (step.field !== field || !step.options) continue;
    const option = step.options.find((o) => o.value === value);
    if (option) return plainLabel(option.label);
  }
  return value;
}
```

- [ ] **Step 4: Прогнати тест**

Run: `npx vitest run src/lib/onboarding/steps.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```powershell
git add src/lib/onboarding/steps.ts src/lib/onboarding/steps.test.ts
git commit -m @'
feat(onboarding): STEPS — declarative quiz flow with tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 3: Engine — видимість, прогрес, навігація, verbosity (+ тести)

**Files:**
- Create: `src/lib/onboarding/engine.ts`
- Test: `src/lib/onboarding/engine.test.ts`

**Interfaces:**
- Consumes: `STEPS`, `getStep` з `./steps`; типи з `./types`.
- Produces (використовує Task 7):
  - `type Answers = Record<string, unknown>`
  - `visibleSteps(answers: Answers): Step[]`
  - `isAnswered(step: Step, answers: Answers): boolean`
  - `questionProgress(key: string, answers: Answers): { index: number; total: number } | null` — лічильник лише по питаннях
  - `nextStepKey(key: string, answers: Answers): string | null`
  - `prevStepKey(key: string, answers: Answers): string | null`
  - `firstUnansweredKey(answers: Answers): string`
  - `isAccessible(key: string, answers: Answers): boolean`
  - `verbosity(answers: Answers): 'beginner' | 'intermediate' | 'advanced'`
  - `showHint(step: Step, answers: Answers): boolean`
  - `resolveInfoContent(step: Step, answers: Answers): { title: string; body?: string }`

- [ ] **Step 1: Написати падаючий тест `src/lib/onboarding/engine.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  visibleSteps,
  questionProgress,
  nextStepKey,
  prevStepKey,
  firstUnansweredKey,
  isAccessible,
  verbosity,
  showHint,
  resolveInfoContent,
} from './engine';
import { getStep } from './steps';

// Повний набір відповідей для maintain_weight (без target_weight).
const answeredAll: Record<string, unknown> = {
  sex: 'female',
  mainGoal: 'maintain_weight',
  nutritionKnowledge: 'advanced',
  shortGoal: ['boost_energy'],
  breakfastTime: '06_08',
  lunchTime: '12_14',
  dinnerTime: '18_20',
  dietaryPreferences: ['none'],
  eatingHabits: ['none'],
  cravings: ['none'],
  foodTracking: 'never',
  mealsPerDay: 'three',
  batchCooking: 'no',
  height: '170',
  weight: '65',
  age: '30',
  activity: '1.2',
  confidence: 'sure',
};

describe('visibleSteps', () => {
  it('hides target_weight until a matching goal is chosen', () => {
    const keys = visibleSteps({}).map((s) => s.key);
    expect(keys).not.toContain('target_weight');
  });

  it('shows target_weight for lose_weight and hides for maintain_weight', () => {
    expect(visibleSteps({ mainGoal: 'lose_weight' }).map((s) => s.key)).toContain('target_weight');
    expect(visibleSteps({ mainGoal: 'maintain_weight' }).map((s) => s.key)).not.toContain('target_weight');
  });
});

describe('questionProgress', () => {
  it('counts only questions, respecting conditions', () => {
    expect(questionProgress('gender', {})).toEqual({ index: 1, total: 18 });
    expect(questionProgress('gender', { mainGoal: 'lose_weight' })).toEqual({ index: 1, total: 19 });
  });

  it('returns null for info screens', () => {
    expect(questionProgress('goal_promise', {})).toBeNull();
  });
});

describe('navigation', () => {
  it('walks forward and backward', () => {
    expect(nextStepKey('gender', {})).toBe('main_goal');
    expect(prevStepKey('main_goal', {})).toBe('gender');
    expect(prevStepKey('gender', {})).toBeNull();
    expect(nextStepKey('analyzing', {})).toBeNull();
  });

  it('skips hidden target_weight', () => {
    expect(nextStepKey('current_weight', { mainGoal: 'maintain_weight' })).toBe('age');
    expect(nextStepKey('current_weight', { mainGoal: 'lose_weight' })).toBe('target_weight');
  });
});

describe('firstUnansweredKey / isAccessible', () => {
  it('gates on the first unanswered question', () => {
    expect(firstUnansweredKey({})).toBe('gender');
    expect(firstUnansweredKey({ sex: 'female' })).toBe('main_goal');
    expect(isAccessible('gender', {})).toBe(true);
    expect(isAccessible('height', {})).toBe(false);
    expect(isAccessible('unknown_step', {})).toBe(false);
  });

  it('info screen right after the gate is reachable', () => {
    // main_goal відповіли → goal_promise (info) доступний, наступне питання теж
    const a = { sex: 'female', mainGoal: 'lose_weight' };
    expect(isAccessible('goal_promise', a)).toBe(true);
    expect(isAccessible('nutrition_knowledge', a)).toBe(true);
    expect(isAccessible('short_goal', a)).toBe(false);
  });

  it('your_profile gates on email + consent, then analyzing opens', () => {
    expect(firstUnansweredKey(answeredAll)).toBe('your_profile');
    expect(isAccessible('analyzing', answeredAll)).toBe(false);
    const done = { ...answeredAll, email: 'a@b.co', personalDataConsent: true };
    expect(firstUnansweredKey(done)).toBe('analyzing');
    expect(isAccessible('analyzing', done)).toBe(true);
  });
});

describe('verbosity / hints / info content', () => {
  it('defaults to beginner before the knowledge question', () => {
    expect(verbosity({})).toBe('beginner');
    expect(verbosity({ nutritionKnowledge: 'advanced' })).toBe('advanced');
  });

  it('shows plain hints to beginners only, hintAlways to everyone', () => {
    const breakfast = getStep('breakfast_time')!; // hint без hintAlways
    const diet = getStep('diet_type')!; // hintAlways
    expect(showHint(breakfast, {})).toBe(true);
    expect(showHint(breakfast, { nutritionKnowledge: 'advanced' })).toBe(false);
    expect(showHint(diet, { nutritionKnowledge: 'advanced' })).toBe(true);
  });

  it('resolves goal_promise variant and bodyShort for advanced', () => {
    const promise = getStep('goal_promise')!;
    expect(resolveInfoContent(promise, { mainGoal: 'lose_weight' }).title).toBe(
      'Схуднути можна без голоду'
    );
    const kbju = getStep('calories_done_for_you')!;
    expect(resolveInfoContent(kbju, { nutritionKnowledge: 'advanced' }).body).toBe(
      kbju.bodyShort
    );
    expect(resolveInfoContent(kbju, {}).body).toBe(kbju.body);
  });
});
```

- [ ] **Step 2: Переконатися, що тест падає**

Run: `npx vitest run src/lib/onboarding/engine.test.ts`
Expected: FAIL — `Cannot find module './engine'`.

- [ ] **Step 3: Створити `src/lib/onboarding/engine.ts`**

```ts
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

/** Титул/текст інфо-екрана з урахуванням variants і bodyShort для advanced. */
export function resolveInfoContent(
  step: Step,
  answers: Answers
): { title: string; body?: string } {
  let title = step.title;
  let body = verbosity(answers) === 'advanced' ? step.bodyShort ?? step.body : step.body;
  if (step.variantOn && step.variants) {
    const v = answers[step.variantOn];
    const variant = typeof v === 'string' ? step.variants[v] : undefined;
    if (variant) {
      title = variant.title ?? title;
      body = variant.body ?? body;
    }
  }
  return { title, body };
}
```

- [ ] **Step 4: Прогнати тести**

Run: `npx vitest run src/lib/onboarding`
Expected: PASS (обидва файли).

- [ ] **Step 5: Commit**

```powershell
git add src/lib/onboarding/engine.ts src/lib/onboarding/engine.test.ts
git commit -m @'
feat(onboarding): quiz engine — visibility, progress, navigation, verbosity

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 4: calcSummary — ІМТ/норма/БЖВ для C6 і D2 (+ тест)

**Files:**
- Create: `src/lib/onboarding/summary.ts`
- Test: `src/lib/onboarding/summary.test.ts`

**Interfaces:**
- Consumes: `calcCalories`, `normalizeSex` з `../calories` (відносний імпорт — vitest без alias).
- Produces: `calcSummary(answers: Record<string, unknown>): { bmr: number; tdee: number; goalCalories: number; bmi: number; proteinG: number; fatG: number; carbsG: number }` — використовують `HowWeCountScreen` (C6) і `ProfileSummaryScreen` (D2) у Task 6.

- [ ] **Step 1: Написати падаючий тест `src/lib/onboarding/summary.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { calcSummary } from './summary';

describe('calcSummary', () => {
  it('computes BMR/TDEE/goal, BMI and macro grams', () => {
    // Жінка, 65 кг, 170 см, 30 років, activity 1.2, maintain:
    // BMR = 10*65 + 6.25*170 - 5*30 - 161 = 1401.5 → 1402 (Math.round)
    // TDEE = round(1402 * 1.2) = 1682; maintain → goal 1682
    const s = calcSummary({
      sex: 'female',
      weight: '65',
      height: '170',
      age: '30',
      activity: '1.2',
      mainGoal: 'maintain_weight',
    });
    expect(s.bmr).toBe(1402);
    expect(s.tdee).toBe(1682);
    expect(s.goalCalories).toBe(1682);
    expect(s.bmi).toBe(22.5); // 65 / 1.7²
    expect(s.proteinG).toBe(Math.round((1682 * 0.3) / 4));
    expect(s.fatG).toBe(Math.round((1682 * 0.3) / 9));
    expect(s.carbsG).toBe(Math.round((1682 * 0.4) / 4));
  });

  it('is defensive about missing values', () => {
    const s = calcSummary({});
    expect(s.bmi).toBe(0);
    expect(Number.isFinite(s.goalCalories)).toBe(true);
  });
});
```

- [ ] **Step 2: Переконатися, що тест падає**

Run: `npx vitest run src/lib/onboarding/summary.test.ts`
Expected: FAIL — `Cannot find module './summary'`.

- [ ] **Step 3: Створити `src/lib/onboarding/summary.ts`**

```ts
// src/lib/onboarding/summary.ts
// Похідні показники з відповідей квізу для екранів C6 (how_we_count)
// і D2 (your_profile). Сервер рахує авторитетно сам — це прев'ю для довіри.
import { calcCalories, normalizeSex } from '../calories';

export interface QuizSummary {
  bmr: number;
  tdee: number;
  goalCalories: number;
  bmi: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

// Орієнтовний спліт макросів 30/30/40 (білки/жири/вуглеводи), 4-9-4 ккал/г.
export function calcSummary(answers: Record<string, unknown>): QuizSummary {
  const weightKg = parseFloat(String(answers.weight ?? '0')) || 0;
  const heightCm = parseFloat(String(answers.height ?? '0')) || 0;
  const ageYears = parseInt(String(answers.age ?? '0'), 10) || 0;
  const sex = normalizeSex(typeof answers.sex === 'string' ? answers.sex : undefined);
  const activityLevel = parseFloat(String(answers.activity ?? '1.2')) || 1.2;
  const mainGoal = typeof answers.mainGoal === 'string' ? answers.mainGoal : undefined;

  const { bmr, tdee, goalCalories } = calcCalories({
    weightKg,
    heightCm,
    ageYears,
    sex,
    activityLevel,
    mainGoal,
  });

  const bmi =
    weightKg > 0 && heightCm > 0
      ? Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10
      : 0;

  return {
    bmr,
    tdee,
    goalCalories,
    bmi,
    proteinG: Math.round((goalCalories * 0.3) / 4),
    fatG: Math.round((goalCalories * 0.3) / 9),
    carbsG: Math.round((goalCalories * 0.4) / 4),
  };
}
```

- [ ] **Step 4: Прогнати тест і повний набір**

Run: `npm test`
Expected: PASS — всі тести (аналітика + 3 нові файли onboarding).

- [ ] **Step 5: Commit**

```powershell
git add src/lib/onboarding/summary.ts src/lib/onboarding/summary.test.ts
git commit -m @'
feat(onboarding): calcSummary — BMI/norm/macros preview for C6 and D2

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 5: QuizLayout + компоненти питань (UI)

**Files:**
- Create: `src/components/onboarding/QuizLayout.tsx`
- Create: `src/components/onboarding/QuestionSingle.tsx`
- Create: `src/components/onboarding/QuestionMulti.tsx`
- Create: `src/components/onboarding/QuestionNumber.tsx`

**Interfaces:**
- Consumes: типи `Step`, `Option` з `@/lib/onboarding/types`.
- Produces (використовує Task 7):
  - `QuizLayout({ title, hint, progress, progressPct, onBack, children })` — `progress: { index: number; total: number } | null`, `progressPct: number`, `onBack?: () => void`
  - `QuizCta({ children, disabled?, onClick })` — named export із `QuizLayout.tsx`, спільна CTA-кнопка (використовують і Task 6 екрани)
  - `QuestionSingle({ step, value, onAnswer })` — `value?: string`, `onAnswer(v: string)`; авто-перехід через 150 мс після вибору
  - `QuestionMulti({ step, value, onAnswer })` — `value?: string[]`, `onAnswer(v: string[])`; кнопка «Далі», логіка `isNone`
  - `QuestionNumber({ step, value, onAnswer })` — `value?: string`, `onAnswer(v: string)`; валідація min/max, зберігає рядок

UI-компоненти не мають юніт-тестів (немає RTL у проєкті) — верифікація: `npx tsc --noEmit` + візуальний прохід у Task 10.

- [ ] **Step 1: Створити `src/components/onboarding/QuizLayout.tsx`**

```tsx
'use client';

import { ChevronLeft } from 'lucide-react';

interface QuizLayoutProps {
  title: string;
  hint?: string;
  /** Лічильник «Питання N з M» — null для інфо-екранів і лоадера. */
  progress: { index: number; total: number } | null;
  /** Заповнення прогрес-бару 0–100 по всіх видимих екранах. */
  progressPct: number;
  onBack?: () => void;
  children: React.ReactNode;
}

export function QuizLayout({
  title,
  hint,
  progress,
  progressPct,
  onBack,
  children,
}: QuizLayoutProps) {
  return (
    <div className="min-h-dvh bg-cream font-body text-ink dark:bg-night dark:text-night-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-8 pt-4">
        <header className="flex items-center">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Назад"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft transition-colors hover:bg-sage-light/40 dark:bg-night-card dark:hover:bg-night-card/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="h-10 w-10" aria-hidden />
          )}
          <span className="flex-1 text-center text-xs font-semibold uppercase tracking-[0.18em] text-ink/60 dark:text-night-muted">
            {progress ? `Питання ${progress.index} з ${progress.total}` : ' '}
          </span>
          <div className="h-10 w-10" aria-hidden />
        </header>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-sage-light/50 dark:bg-night-card">
          <div
            className="h-full rounded-full bg-sage transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>

        <h1 className="mt-8 font-heading text-[28px] font-bold leading-snug">{title}</h1>
        {hint && (
          <p className="mt-3 text-[15px] leading-relaxed text-ink/70 dark:text-night-muted">
            {hint}
          </p>
        )}

        <div className="mt-6 flex flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}

export function QuizCta({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-2xl bg-terracotta px-6 py-4 text-center font-heading font-bold text-white shadow-soft transition-colors hover:bg-terracotta-dark disabled:opacity-40 disabled:hover:bg-terracotta"
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 2: Створити `src/components/onboarding/QuestionSingle.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { Step } from '@/lib/onboarding/types';

interface Props {
  step: Step;
  value?: string;
  onAnswer: (value: string) => void;
}

export function QuestionSingle({ step, value, onAnswer }: Props) {
  const [selected, setSelected] = useState(value ?? '');

  const pick = (v: string) => {
    setSelected(v);
    // Коротка пауза для візуального фідбеку перед авто-переходом.
    setTimeout(() => onAnswer(v), 150);
  };

  return (
    <div className="flex flex-col gap-3">
      {(step.options ?? []).map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => pick(o.value)}
          className={`w-full rounded-2xl border-2 bg-card px-4 py-3.5 text-left shadow-soft transition-colors dark:bg-night-card ${
            selected === o.value ? 'border-sage' : 'border-transparent'
          }`}
        >
          <span className="block font-semibold">{o.label}</span>
          {o.description && (
            <span className="mt-0.5 block text-sm text-ink/60 dark:text-night-muted">
              {o.description}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Створити `src/components/onboarding/QuestionMulti.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Option, Step } from '@/lib/onboarding/types';
import { QuizCta } from './QuizLayout';

interface Props {
  step: Step;
  value?: string[];
  onAnswer: (value: string[]) => void;
}

export function QuestionMulti({ step, value, onAnswer }: Props) {
  const [selected, setSelected] = useState<string[]>(value ?? []);
  const options = step.options ?? [];
  const noneValues = options.filter((o) => o.isNone).map((o) => o.value);

  const toggle = (o: Option) => {
    setSelected((prev) => {
      if (prev.includes(o.value)) return prev.filter((v) => v !== o.value);
      // «Нічого з переліченого» знімає інші вибори — і навпаки.
      if (o.isNone) return [o.value];
      return [...prev.filter((v) => !noneValues.includes(v)), o.value];
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <p className="mb-3 text-sm text-ink/60 dark:text-night-muted">
        Обери все, що підходить
      </p>
      <div className="flex flex-col gap-3">
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o)}
              className={`flex w-full items-center justify-between rounded-2xl border-2 bg-card px-4 py-3.5 text-left shadow-soft transition-colors dark:bg-night-card ${
                active ? 'border-sage' : 'border-transparent'
              }`}
            >
              <span>
                <span className="block font-semibold">{o.label}</span>
                {o.description && (
                  <span className="mt-0.5 block text-sm text-ink/60 dark:text-night-muted">
                    {o.description}
                  </span>
                )}
              </span>
              <span
                className={`ml-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                  active
                    ? 'border-sage bg-sage text-white'
                    : 'border-ink/20 dark:border-night-muted/40'
                }`}
              >
                {active && <Check className="h-4 w-4" />}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-8 pb-2 pt-4">
        <QuizCta disabled={selected.length === 0} onClick={() => onAnswer(selected)}>
          Далі
        </QuizCta>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Створити `src/components/onboarding/QuestionNumber.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { Step } from '@/lib/onboarding/types';
import { QuizCta } from './QuizLayout';

interface Props {
  step: Step;
  value?: string;
  onAnswer: (value: string) => void;
}

export function QuestionNumber({ step, value, onAnswer }: Props) {
  const [raw, setRaw] = useState(value ?? '');
  const n = parseFloat(raw);
  const valid =
    raw !== '' &&
    !Number.isNaN(n) &&
    (step.min === undefined || n >= step.min) &&
    (step.max === undefined || n <= step.max);
  const showError = raw !== '' && !valid;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-end gap-3">
        <input
          type="number"
          inputMode="decimal"
          autoFocus
          value={raw}
          min={step.min}
          max={step.max}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && valid) onAnswer(String(n));
          }}
          className="w-40 rounded-2xl border-2 border-transparent bg-card px-4 py-3.5 font-heading text-3xl font-bold shadow-soft outline-none transition-colors focus:border-sage dark:bg-night-card"
        />
        {step.unit && (
          <span className="pb-4 text-lg text-ink/60 dark:text-night-muted">{step.unit}</span>
        )}
      </div>
      {showError && (
        <p className="mt-2 text-sm text-danger dark:text-danger-dark">
          Введи число від {step.min} до {step.max}
        </p>
      )}
      <div className="mt-8 pb-2 pt-4">
        <QuizCta disabled={!valid} onClick={() => onAnswer(String(n))}>
          Далі
        </QuizCta>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Перевірити типи**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```powershell
git add src/components/onboarding
git commit -m @'
feat(onboarding): QuizLayout + single/multi/number question components

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 6: Інфо-екрани, HowWeCount, ProfileSummary (D2), Loader (D3)

**Files:**
- Create: `src/components/onboarding/InfoScreen.tsx`
- Create: `src/components/onboarding/HowWeCountScreen.tsx`
- Create: `src/components/onboarding/ProfileSummaryScreen.tsx`
- Create: `src/components/onboarding/LoaderScreen.tsx`

**Interfaces:**
- Consumes: `Step` з `@/lib/onboarding/types`; `calcSummary` з `@/lib/onboarding/summary`; `QuizCta` з `./QuizLayout`; `getOnboardingData`, `setOnboardingData` з `@/utils/onboardingHelpers`; `track` з `@/lib/analytics`.
- Produces (використовує Task 7):
  - `InfoScreen({ step, body, onNext })` — `body?: string` (уже резолвлений через `resolveInfoContent`), картинка з фолбеком, картка експерта для `key === 'expert'`
  - `HowWeCountScreen({ answers, onNext })` — `answers: Record<string, unknown>`
  - `ProfileSummaryScreen({ answers, onDone })` — `onDone(email: string)`: батько зберігає email+згоду й переходить далі
  - `LoaderScreen()` — самодостатній: POST `/api/onboarding`, стадії, `track('onboarding_completed')`, `router.push('/payment/plan')`

- [ ] **Step 1: Створити `src/components/onboarding/InfoScreen.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { Step } from '@/lib/onboarding/types';
import { QuizCta } from './QuizLayout';

interface Props {
  step: Step;
  /** Текст, уже резолвлений через resolveInfoContent (variants + bodyShort). */
  body?: string;
  onNext: () => void;
}

export function InfoScreen({ step, body, onNext }: Props) {
  return (
    <div className="flex flex-1 flex-col">
      {body && (
        <p className="text-[17px] leading-relaxed text-ink/80 dark:text-night-ink/80">{body}</p>
      )}
      {step.image && <QuizImage image={step.image} />}
      {step.key === 'expert' && <ExpertCard />}
      <div className="mt-auto pb-2 pt-8">
        <QuizCta onClick={onNext}>Продовжити</QuizCta>
      </div>
    </div>
  );
}

// Скріни з застосунку (B5, B9) можуть ще не існувати — тоді м'який placeholder.
function QuizImage({ image }: { image: { src: string; alt: string } }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="mt-6 flex h-48 items-center justify-center rounded-3xl bg-sage-light/40 text-5xl dark:bg-night-card">
        📱
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.src}
      alt={image.alt}
      onError={() => setFailed(true)}
      className="mt-6 w-full rounded-3xl shadow-soft"
    />
  );
}

// B13. Фото — public/onboarding/expert.jpg; до появи файлу — ініціали.
function ExpertCard() {
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <div className="mt-6 rounded-3xl bg-card p-5 shadow-soft dark:bg-night-card">
      <div className="flex items-center gap-4">
        {photoFailed ? (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-sage font-heading text-xl font-bold text-white">
            ЮТ
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/onboarding/expert.jpg"
            alt="Юрій Теслюк"
            onError={() => setPhotoFailed(true)}
            className="h-16 w-16 flex-shrink-0 rounded-full object-cover"
          />
        )}
        <div>
          <p className="font-heading text-lg font-bold">Юрій Теслюк</p>
          <p className="text-sm text-ink/60 dark:text-night-muted">15 років у фітнесі</p>
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-2 text-sm leading-relaxed text-ink/80 dark:text-night-ink/80">
        <li>· 10 років персональним тренером у «Адреналін», Тернопіль</li>
        <li>· Сертифікат курсу «Здорове харчування», Prometheus</li>
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Створити `src/components/onboarding/HowWeCountScreen.tsx`** (C6)

```tsx
'use client';

import { calcSummary } from '@/lib/onboarding/summary';
import { QuizCta } from './QuizLayout';

interface Props {
  answers: Record<string, unknown>;
  onNext: () => void;
}

// C6: формула Mifflin-St Jeor і три числа BMR → TDEE → норма.
export function HowWeCountScreen({ answers, onNext }: Props) {
  const s = calcSummary(answers);
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-[17px] leading-relaxed text-ink/80 dark:text-night-ink/80">
        Використовуємо формулу Міффліна-Сан Жеора — стандарт, яким користуються
        дієтологи. Без магії, лише арифметика:
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <StatRow
          label="Базовий обмін (BMR)"
          note="Скільки тіло витрачає у спокої"
          value={`${s.bmr} ккал`}
        />
        <StatRow
          label="З урахуванням активності (TDEE)"
          note="BMR × твій рівень активності"
          value={`${s.tdee} ккал`}
        />
        <StatRow
          label="Твоя добова норма"
          note="TDEE з корекцією під твою ціль"
          value={`${s.goalCalories} ккал`}
          accent
        />
      </div>
      <div className="mt-auto pb-2 pt-8">
        <QuizCta onClick={onNext}>Продовжити</QuizCta>
      </div>
    </div>
  );
}

function StatRow({
  label,
  note,
  value,
  accent,
}: {
  label: string;
  note: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3.5 shadow-soft dark:bg-night-card">
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-ink/60 dark:text-night-muted">{note}</p>
      </div>
      <p
        className={`ml-3 font-heading text-xl font-bold ${
          accent ? 'text-terracotta' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Створити `src/components/onboarding/ProfileSummaryScreen.tsx`** (D2)

```tsx
'use client';

import { useState } from 'react';
import type { Step } from '@/lib/onboarding/types';
import { calcSummary } from '@/lib/onboarding/summary';
import { QuizCta } from './QuizLayout';

interface Props {
  step: Step;
  answers: Record<string, unknown>;
  /** Батько зберігає email + personalDataConsent і переходить до лоадера. */
  onDone: (email: string) => void;
}

const EMAIL_RE = /\S+@\S+\.\S+/;

export function ProfileSummaryScreen({ step, answers, onDone }: Props) {
  const s = calcSummary(answers);
  const [email, setEmail] = useState(
    typeof answers.email === 'string' ? answers.email : ''
  );
  const [consent, setConsent] = useState(answers.personalDataConsent === true);
  const canSubmit = EMAIL_RE.test(email) && consent;

  return (
    <div className="flex flex-1 flex-col">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="ІМТ" value={String(s.bmi)} />
        <StatCard label="Норма на день" value={`${s.goalCalories} ккал`} accent />
        <div className="col-span-2 rounded-2xl bg-card px-4 py-3.5 shadow-soft dark:bg-night-card">
          <p className="text-sm text-ink/60 dark:text-night-muted">Орієнтовний БЖВ</p>
          <p className="mt-1 font-heading font-bold">
            {s.proteinG} г білка · {s.fatG} г жирів · {s.carbsG} г вуглеводів
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink/60 dark:text-night-muted">
        Розрахунок орієнтовний і не є медичною рекомендацією. За наявності
        хронічних захворювань порадься з лікарем.
      </p>

      <div className="mt-6">
        <label
          htmlFor="quiz-email"
          className="mb-2 block text-[15px] font-semibold"
        >
          Залиш пошту, щоб ми зберегли твої дані і склали меню.
        </label>
        <input
          id="quiz-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="ph-no-capture w-full rounded-2xl border-2 border-transparent bg-card px-4 py-3.5 shadow-soft outline-none transition-colors focus:border-sage dark:bg-night-card"
        />
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-ink/80 dark:text-night-ink/80">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-sage"
          />
          <span>{step.consent?.text ?? 'Я надаю згоду на обробку моїх персональних даних'}</span>
        </label>
      </div>

      <div className="mt-auto pb-2 pt-8">
        <QuizCta disabled={!canSubmit} onClick={() => onDone(email.trim())}>
          Скласти моє меню
        </QuizCta>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-card px-4 py-3.5 shadow-soft dark:bg-night-card">
      <p className="text-sm text-ink/60 dark:text-night-muted">{label}</p>
      <p
        className={`mt-1 font-heading text-2xl font-bold ${
          accent ? 'text-terracotta' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Створити `src/components/onboarding/LoaderScreen.tsx`** (D3)

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { getOnboardingData } from '@/utils/onboardingHelpers';
import { track } from '@/lib/analytics';

const STAGES = ['Профіль', 'Харчові звички', 'Обмеження', 'Норма калорій', 'Меню'];
const STAGE_MS = 1200;

// D3: фіксована тривалість (до появи /api/menu/preview — спека §7 п.5).
// POST /api/onboarding — no-op підтвердження; onboarding_completed — перед
// редіректом на /payment/plan (перенесено з creating-plan/page.tsx:34).
export function LoaderScreen() {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const submitted = useRef(false);
  const completed = useRef(false);

  useEffect(() => {
    if (!submitted.current) {
      submitted.current = true;
      fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getOnboardingData()),
      }).catch(() => {});
    }

    const id = setInterval(() => {
      setStage((s) => {
        if (s >= STAGES.length - 1) {
          clearInterval(id);
          if (!completed.current) {
            completed.current = true;
            track('onboarding_completed');
            router.push('/payment/plan');
          }
          return s;
        }
        return s + 1;
      });
    }, STAGE_MS);

    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="flex flex-1 flex-col justify-center gap-3 pb-16">
      {STAGES.map((label, i) => {
        const done = i < stage;
        const current = i === stage;
        return (
          <div
            key={label}
            className={`flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-soft transition-opacity dark:bg-night-card ${
              done || current ? 'opacity-100' : 'opacity-40'
            }`}
          >
            <span
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                done
                  ? 'bg-sage text-white'
                  : current
                    ? 'border-2 border-sage'
                    : 'border-2 border-ink/20 dark:border-night-muted/40'
              }`}
            >
              {done && <Check className="h-4 w-4" />}
              {current && (
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sage" />
              )}
            </span>
            <span className="font-semibold">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 5: Перевірити типи**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```powershell
git add src/components/onboarding
git commit -m @'
feat(onboarding): info screens, how-we-count, profile summary (D2), loader (D3)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 7: StepRenderer + маршрути `/onboarding/[step]` + аналітика

**Files:**
- Modify: `src/lib/analytics/events.ts`
- Create: `src/components/onboarding/StepRenderer.tsx`
- Create: `src/app/onboarding/[step]/page.tsx`
- Modify: `src/app/onboarding/page.tsx` (redirect на перший крок)

**Interfaces:**
- Consumes: усе з Task 2–6; `getOnboardingData`, `setOnboardingData` з `@/utils/onboardingHelpers`; `TrackEvent` з `@/components/analytics/TrackEvent`; `track` з `@/lib/analytics`.
- Produces: маршрут `/onboarding/[step]`; подія `onboarding_step_view` з `{ key, index, group }`; `onboarding_started` (withUtmSource) на першому кроці.

- [ ] **Step 1: Додати подію в `src/lib/analytics/events.ts`** — у секцію `// Funnel events` після `'onboarding_started'`:

```ts
  | 'onboarding_started'
  | 'onboarding_step_view'
  | 'onboarding_completed'
```

- [ ] **Step 2: Створити `src/components/onboarding/StepRenderer.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STEPS, getStep } from '@/lib/onboarding/steps';
import {
  firstUnansweredKey,
  isAccessible,
  nextStepKey,
  prevStepKey,
  questionProgress,
  resolveInfoContent,
  showHint,
  visibleSteps,
  type Answers,
} from '@/lib/onboarding/engine';
import { getOnboardingData, setOnboardingData } from '@/utils/onboardingHelpers';
import { track } from '@/lib/analytics';
import { TrackEvent } from '@/components/analytics/TrackEvent';
import { QuizLayout } from './QuizLayout';
import { QuestionSingle } from './QuestionSingle';
import { QuestionMulti } from './QuestionMulti';
import { QuestionNumber } from './QuestionNumber';
import { InfoScreen } from './InfoScreen';
import { HowWeCountScreen } from './HowWeCountScreen';
import { ProfileSummaryScreen } from './ProfileSummaryScreen';
import { LoaderScreen } from './LoaderScreen';

export function StepRenderer({ stepKey }: { stepKey: string }) {
  const router = useRouter();
  // null = ще не читали localStorage (перший клієнтський рендер).
  const [answers, setAnswers] = useState<Answers | null>(null);
  const trackedKey = useRef<string | null>(null);

  useEffect(() => {
    setAnswers(getOnboardingData() as Answers);
  }, [stepKey]);

  const step = getStep(stepKey);
  const ready = answers !== null;
  const accessible = ready && !!step && isAccessible(stepKey, answers);

  // Невідомий або ще недоступний ключ → перший незаповнений крок.
  useEffect(() => {
    if (ready && !accessible) {
      router.replace(`/onboarding/${firstUnansweredKey(answers)}`);
    }
  }, [ready, accessible, answers, router]);

  // onboarding_step_view — один раз на ключ.
  useEffect(() => {
    if (!ready || !accessible || !step || trackedKey.current === stepKey) return;
    trackedKey.current = stepKey;
    const index = visibleSteps(answers).findIndex((s) => s.key === stepKey);
    track('onboarding_step_view', { key: stepKey, index, group: step.group });
  }, [ready, accessible, answers, step, stepKey]);

  if (!ready || !step || !accessible) return null; // редірект у польоті

  const goTo = (key: string | null) => {
    if (key) router.push(`/onboarding/${key}`);
  };

  const saveAnswer = (field: string, value: unknown) => {
    setOnboardingData(field, value);
    const next = { ...answers, [field]: value };
    setAnswers(next);
    goTo(nextStepKey(stepKey, next));
  };

  const goNext = () => goTo(nextStepKey(stepKey, answers));

  const handleProfileDone = (email: string) => {
    setOnboardingData('email', email);
    setOnboardingData('personalDataConsent', true);
    const next = { ...answers, email, personalDataConsent: true };
    setAnswers(next);
    goTo(nextStepKey(stepKey, next));
  };

  const visible = visibleSteps(answers);
  const stepIndex = visible.findIndex((s) => s.key === stepKey);
  const progressPct = ((stepIndex + 1) / visible.length) * 100;
  const progress = step.type === 'question' ? questionProgress(stepKey, answers) : null;
  const info = step.type === 'info' ? resolveInfoContent(step, answers) : null;
  const isFirst = stepKey === STEPS[0].key;
  const prev = prevStepKey(stepKey, answers);
  const onBack =
    step.type === 'loader' || isFirst || !prev ? undefined : () => goTo(prev);

  let content: React.ReactNode;
  if (step.type === 'loader') {
    content = <LoaderScreen />;
  } else if (step.key === 'how_we_count') {
    content = <HowWeCountScreen answers={answers} onNext={goNext} />;
  } else if (step.key === 'your_profile') {
    content = (
      <ProfileSummaryScreen step={step} answers={answers} onDone={handleProfileDone} />
    );
  } else if (step.type === 'info') {
    content = <InfoScreen step={step} body={info?.body} onNext={goNext} />;
  } else if (step.questionType === 'single') {
    content = (
      <QuestionSingle
        key={stepKey}
        step={step}
        value={answers[step.field!] as string | undefined}
        onAnswer={(v) => saveAnswer(step.field!, v)}
      />
    );
  } else if (step.questionType === 'multi') {
    content = (
      <QuestionMulti
        key={stepKey}
        step={step}
        value={answers[step.field!] as string[] | undefined}
        onAnswer={(v) => saveAnswer(step.field!, v)}
      />
    );
  } else {
    content = (
      <QuestionNumber
        key={stepKey}
        step={step}
        value={answers[step.field!] as string | undefined}
        onAnswer={(v) => saveAnswer(step.field!, v)}
      />
    );
  }

  return (
    <QuizLayout
      title={info?.title ?? step.title}
      hint={showHint(step, answers) ? step.hint : undefined}
      progress={progress}
      progressPct={progressPct}
      onBack={onBack}
    >
      {isFirst && <TrackEvent event="onboarding_started" withUtmSource />}
      {content}
    </QuizLayout>
  );
}
```

- [ ] **Step 3: Створити `src/app/onboarding/[step]/page.tsx`**

```tsx
'use client';

import { use } from 'react';
import { StepRenderer } from '@/components/onboarding/StepRenderer';

// Next 15: params у клієнтській сторінці — Promise, розпаковуємо через use().
export default function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = use(params);
  return <StepRenderer stepKey={step} />;
}
```

- [ ] **Step 4: Переписати `src/app/onboarding/page.tsx`** (повна заміна вмісту)

```tsx
import { redirect } from 'next/navigation';
import { STEPS } from '@/lib/onboarding/steps';

// onboarding_started тепер стріляє StepRenderer на першому кроці.
export default function OnboardingIndex() {
  redirect(`/onboarding/${STEPS[0].key}`);
}
```

- [ ] **Step 5: Перевірити типи + тести**

Run: `npx tsc --noEmit`
Expected: exit 0.
Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Швидка перевірка в dev** (dev-сервер уже запущений або `npm run dev`)

Відкрити `http://localhost:3000/onboarding` → редірект на `/onboarding/gender`; пройти 3-4 кроки; перевірити, що `/onboarding/height` напряму (у чистому браузері/інкогніто) редіректить назад на `gender`.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/analytics/events.ts src/components/onboarding/StepRenderer.tsx "src/app/onboarding/[step]" src/app/onboarding/page.tsx
git commit -m @'
feat(onboarding): dynamic /onboarding/[step] route with StepRenderer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 8: `/payment/plan` — лейбли зі STEPS, згода з онбордингу; рестайл OnboardingLayout

**Files:**
- Modify: `src/app/payment/plan/page.tsx`
- Modify: `src/components/onboardingPage/OnboardingLayout.tsx`

**Interfaces:**
- Consumes: `labelFor` з `@/lib/onboarding/steps` (Task 2).
- Produces: нічого нового; сторінка оплати без дубльованих таблиць лейблів.

Рішення (зі спеки §8): email-поле на сторінці оплати **залишається** як фолбек (префіл з localStorage/БД уже працює — повертальники без email не застрягають). Чекбокс персональних даних залишається, але **пре-чекається** з `personalDataConsent`, зібраного на D2.

- [ ] **Step 1: Прибрати таблиці лейблів і блок additionalGoal у `src/app/payment/plan/page.tsx`**

Видалити рядки 20–44 (константи `MAIN_GOAL_LABELS`, `SHORT_GOAL_LABELS`, `ADDITIONAL_GOAL_LABELS` разом із коментарем «Human-readable labels…»). Додати імпорт:

```ts
import { labelFor } from '@/lib/onboarding/steps';
```

Замінити `goalsList` (useMemo, рядки 118–138) на:

```ts
  const goalsList = useMemo(() => {
    const goals: string[] = [];
    if (data.mainGoal)
      goals.push(`Головна ціль: ${labelFor('mainGoal', data.mainGoal)}`);
    if (data.shortGoal?.length)
      goals.push(
        `Короткі цілі: ${data.shortGoal.map((g) => labelFor('shortGoal', g)).join(', ')}`
      );
    return goals;
  }, [data]);
```

- [ ] **Step 2: Пре-чек згоди з онбордингу** — у першому `useEffect` після `if ((d as any).email) setEmail((d as any).email);` додати:

```ts
    if (d.personalDataConsent) setAgreePersonalData(true);
```

- [ ] **Step 3: Рестайл CTA-кнопки оплати** — замінити className кнопки `onPay` (градієнт `from-red-500 to-orange-500`, рядок ~372) на:

```tsx
            className={`w-full rounded-xl bg-terracotta p-4 text-center text-white transition-colors hover:bg-terracotta-dark ${
              submitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
```

- [ ] **Step 4: Рестайл `src/components/onboardingPage/OnboardingLayout.tsx`** (повна заміна — компонент лишається, його використовують `/payment/plan`, `/payment/result`, `/auth/login`, `/auth/confirm`)

```tsx
// components/onboardingPage/OnboardingLayout.tsx
// Обгортка сторінок оплати й auth. Бренд-бук NutriDay: крем/night фон,
// картка на bg-card, заголовки Comfortaa (font-heading).
import React from 'react';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  children,
  title,
  subtitle,
}) => {
  return (
    <div className="min-h-screen bg-cream font-body text-ink dark:bg-night dark:text-night-ink">
      <main>
        <section className="relative">
          <div className="div-container relative z-10 mx-auto flex flex-col gap-5 py-[44px] text-center md:gap-10">
            <h1 className="mt-14 text-center font-heading text-3xl font-bold md:text-4xl">
              {title}
            </h1>
            {subtitle && (
              <p className="text-lg text-ink/70 dark:text-night-muted">{subtitle}</p>
            )}
          </div>
        </section>
        <section>
          <div className="div-container mx-auto py-[20px] md:py-[44px]">
            <div className="flex justify-center">
              <div className="flex w-full max-w-[600px] flex-col rounded-3xl bg-card p-8 shadow-soft dark:bg-night-card md:p-12">
                {children}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
```

Примітка: секції всередині `/payment/plan` мають `bg-white dark:bg-dark-body` — на фоні `bg-card` це прийнятно (білі вкладені картки); повний рестайл сторінки оплати — окрема задача, тут не чіпаємо.

- [ ] **Step 5: Перевірити типи**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Перевірити в dev**

Пройти квіз до D2, ввести email + згоду → лоадер → `/payment/plan`: цілі показуються без емодзі, email префілиться, чекбокс персональних даних уже стоїть.

- [ ] **Step 7: Commit**

```powershell
git add src/app/payment/plan/page.tsx src/components/onboardingPage/OnboardingLayout.tsx
git commit -m @'
refactor(payment): labels from STEPS, consent prefill; brand-book OnboardingLayout

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 9: Видалення старих сторінок і полів; dietaryPreferences у профіль

**Files:**
- Delete: 17 тек у `src/app/onboarding/` (усі, крім `page.tsx` і `[step]/`)
- Delete: невикористані компоненти в `src/components/onboardingPage/`
- Modify: `src/types/onboarding.ts` (видалити 8 мертвих полів)
- Modify: `src/app/api/profile/route.ts` (dietaryPreferences з онбордингу)

**Interfaces:**
- Consumes: `OnboardingData.dietaryPreferences` (Task 1).
- Produces: чистий тип `OnboardingData`; профіль створюється з `dietaryPreferences` користувача.

- [ ] **Step 1: Видалити 17 старих сторінок**

```powershell
Remove-Item -Recurse -Force -Confirm:$false `
  src/app/onboarding/goals, src/app/onboarding/main-goal, src/app/onboarding/goal-reason, `
  src/app/onboarding/additional-goal, src/app/onboarding/short-goal, src/app/onboarding/short-barriers, `
  src/app/onboarding/nutrition-knowledge, src/app/onboarding/welcome-new-you, src/app/onboarding/thank-for-trust, `
  src/app/onboarding/past-experience, src/app/onboarding/past-challenges, src/app/onboarding/challenges-overcome, `
  src/app/onboarding/changes-role-model, src/app/onboarding/changes-success-factors, `
  src/app/onboarding/build-muscle-experience, src/app/onboarding/gain-weight-experience, `
  src/app/onboarding/creating-plan
```

- [ ] **Step 2: Знайти, які компоненти onboardingPage ще використовуються**

Run: `npx tsc --noEmit` — і grep імпортів:

```powershell
Select-String -Path src -Pattern "onboardingPage/(Button|RadioButton|CheckboxButton|InputSkeleton|calcComponent|CaloriesCalc)" -SimpleMatch:$false -Recurse | Select-Object Path, Line
```

Expected: збіги лише всередині самих `src/components/onboardingPage/*` (взаємні імпорти). Якщо якийсь компонент імпортують живі сторінки (auth/payment) — той файл НЕ видаляти, повідомити в підсумку задачі.

- [ ] **Step 3: Видалити мертві компоненти** (за замовчуванням — усі, крім `OnboardingLayout.tsx`)

```powershell
Remove-Item -Force -Confirm:$false `
  src/components/onboardingPage/calcComponent.tsx, `
  src/components/onboardingPage/CaloriesCalcList.tsx, `
  src/components/onboardingPage/CaloriesCalcFormula.tsx, `
  src/components/onboardingPage/CaloriesDescription.tsx, `
  src/components/onboardingPage/InputSkeleton.tsx, `
  src/components/onboardingPage/RadioButton.tsx, `
  src/components/onboardingPage/CheckboxButton.tsx, `
  src/components/onboardingPage/Button.tsx
```

- [ ] **Step 4: Почистити `src/types/onboarding.ts`** (повна заміна)

```ts
export interface OnboardingData {
  mainGoal?: string;
  shortGoal?: string[];
  nutritionKnowledge?: string;
  // Тіло (зберігаються рядками — calcProfile робить parseFloat)
  sex?: string;
  age?: string;
  weight?: string;
  height?: string;
  activity?: string;
  // Новий квіз (docs/ONBOARDING_QUIZ_SPEC.md §2)
  targetWeight?: string;
  breakfastTime?: string;
  lunchTime?: string;
  dinnerTime?: string;
  dietaryPreferences?: string[];
  eatingHabits?: string[];
  cravings?: string[];
  foodTracking?: string;
  mealsPerDay?: string;
  batchCooking?: string;
  confidence?: string;
  // Contact
  email?: string;
  personalDataConsent?: boolean;
}
```

> Старі документи в Mongo (`onboarding: Record<string, any>`) не мігруються —
> зайві поля просто ігноруються, `calcProfile` читає лише живі ключі.

- [ ] **Step 5: dietaryPreferences у `src/app/api/profile/route.ts`** — у `calcProfile` замінити рядок `dietaryPreferences: [],` на:

```ts
    // 'none' («Їм усе») — службове значення квізу, у профіль не пишемо.
    dietaryPreferences: (onboarding.dietaryPreferences ?? []).filter((v) => v !== 'none'),
```

(`allergies`, `dislikedFoods`, `favoriteFoods` лишаються `[]` свідомо — вносяться в профілі після оплати.)

- [ ] **Step 6: Пошук залишків мертвих полів**

```powershell
Select-String -Path src -Pattern "goalReason|shortBarriers|additionalGoal|buildMuscleExperience|pastExperience|gainWeightExperience|pastChallenges|roleModel" -Recurse | Select-Object Path, Line
```

Expected: збігів у `src/` немає (збіги в `docs/` — норм). Якщо є — виправити місце використання.

- [ ] **Step 7: Типи + тести**

Run: `npx tsc --noEmit`
Expected: exit 0.
Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add -A
git commit -m @'
refactor(onboarding): drop 18 legacy quiz pages, dead fields; dietaryPreferences to profile

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 10: Наскрізна верифікація

**Files:** нових немає.

- [ ] **Step 1: Повна перевірка типів і тестів**

Run: `npx tsc --noEmit` → exit 0. Run: `npm test` → PASS, 0 failed.

- [ ] **Step 2: Ручний прохід у dev** (`npm run dev`; НЕ запускати `next build` паралельно)

Чекліст (світла + темна тема, мобільний вьюпорт ~390px):
1. `/onboarding` → редірект на `/onboarding/gender`; лічильник «Питання 1 з 18»; кнопки «Назад» немає.
2. Обрати «Жінка» → авто-перехід на `main_goal`; браузерна кнопка «назад» повертає на `gender` зі збереженим вибором.
3. `main_goal = lose_weight` → `goal_promise` показує «Схуднути можна без голоду»; лічильник зникає на інфо-екрані; всього питань стає 19.
4. `nutrition_knowledge = advanced` → далі підписи-hint без `hintAlways` зникають (напр. `breakfast_time`), а `diet_type` і `current_weight` (hintAlways) — лишаються.
5. `diet_type`: вибір «Їм усе» знімає інші; вибір «Кето» знімає «Їм усе»; «Далі» неактивна при 0 вибраних.
6. `height`: 99 → помилка «Введи число від 100 до 220», кнопка неактивна; 170 → далі.
7. `main_goal = maintain_weight` (повернутись і змінити) → `target_weight` пропускається.
8. `how_we_count` показує BMR/TDEE/норму — числа збігаються зі здоровим глуздом (жінка 65/170/30, activity 1.2 → ~1402/1682).
9. `your_profile`: CTA неактивна без email або згоди; з email+згодою → `analyzing`: 5 стадій → `/payment/plan`.
10. `/payment/plan`: цілі без емодзі, email префілиться, чекбокс персональних даних пре-чекнутий, кнопка оплати — terracotta.
11. `/onboarding/analyzing` напряму в інкогніто → редірект на `gender`.
12. У консолі dev видно `onboarding_started`, `onboarding_step_view` (по одному на крок), `onboarding_completed` (analytics debug log).

- [ ] **Step 3: Використати superpowers:verification-before-completion і superpowers:requesting-code-review перед фіналом**

- [ ] **Step 4: Фінальний коміт (якщо були правки після проходу)**

```powershell
git add -A
git commit -m @'
fix(onboarding): polish after end-to-end walkthrough

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

## Поза планом (свідомо)

- `/api/menu/preview`, фолбек-меню, крок D4 `menu_preview` — окрема задача (спека §7 п.5).
- Скріни для B5/B9 і фото експерта — покласти у `public/onboarding/` (`day-demo.png`, `kbju-demo.png`, `expert.jpg`), код уже має фолбеки.
- Час/кількість прийомів їжі → промпт генератора; пуші за `eatingHabits`/`cravings`; прогноз за `targetWeight` — наступні задачі зі спеки §7.
