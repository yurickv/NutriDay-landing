// src/lib/onboarding/types.ts
// Модель даних квізу онбордингу — див. docs/ONBOARDING_QUIZ_SPEC.md §1.

export type StepType = 'question' | 'info' | 'loader';
export type QuestionType = 'single' | 'multi' | 'number';
export type StepGroup = 'goal' | 'nutrition' | 'body' | 'finish';

/**
 * Іконки варіантів — імена компонентів lucide-react. Реєстр імені → компонент
 * живе в src/components/onboarding/OptionIcon.tsx; додаючи назву сюди,
 * TypeScript змусить додати її і в реєстр.
 */
export type OptionIconName =
  // main_goal
  | 'TrendingDown'
  | 'Scale'
  | 'Dumbbell'
  | 'TrendingUp'
  | 'Utensils'
  // nutrition_knowledge
  | 'Sprout'
  | 'BookOpen'
  | 'GraduationCap'
  // short_goal
  | 'Salad'
  | 'Zap'
  | 'Target'
  | 'HeartHandshake'
  | 'CalendarCheck'
  // diet_type
  | 'EggFried'
  | 'WheatOff'
  | 'MilkOff'
  | 'Ham'
  | 'FishOff'
  | 'CandyOff'
  // eating_habits
  | 'Frown'
  | 'HandPlatter'
  | 'MoonStar'
  | 'UtensilsCrossed'
  // cravings
  | 'Cookie'
  | 'Popcorn'
  | 'Pizza'
  | 'CupSoda'
  | 'Ban'
  // activity
  | 'Armchair'
  | 'PersonStanding'
  | 'Footprints'
  | 'HardHat'
  // confidence
  | 'Flame'
  | 'Smile'
  | 'CircleHelp';

export interface Option {
  value: string;
  label: string;
  description?: string; // пояснення під варіантом (патерн /diet_type)
  isNone?: boolean; // «нічого з переліченого» — знімає інші вибори
  image?: string; // фото-картка: опції рендеряться грідом 2 колонки (крок gender)
  icon?: OptionIconName; // іконка-бейдж ліворуч від підпису (замість емодзі)
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

  /**
   * Фото-банер угорі екрана, під заголовком і над контентом (кроки прийомів
   * їжі). Рендериться QuizLayout фіксованою висотою + object-cover, тож усі
   * кроки виглядають однаково незалежно від пропорцій вихідного файлу.
   * Не плутати з `image` нижче — той малюється всередині інфо-екрана.
   */
  headerImage?: { src: string; alt: string };

  // --- question ---
  questionType?: QuestionType;
  field?: string; // куди пишемо у OnboardingData
  options?: Option[];
  min?: number; // для number
  max?: number;
  unit?: string; // 'см' | 'кг' | 'років'
  stickyCta?: boolean; // кнопка «Далі» липне до низу екрана (довгі/скрольні екрани)

  // --- info / loader ---
  body?: string; // основний текст
  bodyShort?: string; // варіант для «просунутих»
  variants?: Record<string, { title?: string; body?: string }>; // текст під відповідь
  variantOn?: string; // поле, від якого залежить variants
  image?: { src: string; alt: string }; // скрін застосунку (B5, B9)
  consent?: { text: string; href: string }; // точкова згода на екрані питання

  wide?: boolean; // широка колонка (1128px) на десктопі — інфо-екрани з фото

  condition?: Predicate[]; // крок показується, якщо всі предикати істинні
  analyticsEvent?: string; // за замовчуванням `onboarding_${key}`
}
