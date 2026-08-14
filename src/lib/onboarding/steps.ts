// src/lib/onboarding/steps.ts
// Увесь флоу онбордингу як дані. Порядок масиву = порядок екранів.
// Тексти — з docs/ONBOARDING_QUIZ_SPEC.md §2; змінюючи копірайт, зважай,
// що labelFor() читають і сторінка оплати, і аналітика.
import type { Step, StepGroup } from './types';

export const STEPS: Step[] = [
  // ── Група A · Мета ─────────────────────────────────────────────
  {
    key: 'gender',
    type: 'question',
    group: 'goal',
    title: 'Sytno план',
    hint: 'Гнучке меню під твої смаки і цілі.',
    hintAlways: true,
    questionType: 'single',
    field: 'sex',
    options: [
      { value: 'female', label: 'Жінка', image: '/onboarding/women.avif' },
      { value: 'male', label: 'Чоловік', image: '/onboarding/men.avif' },
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
      { value: 'lose_weight', label: 'Схуднути', icon: 'TrendingDown' },
      { value: 'maintain_weight', label: 'Підтримати вагу', icon: 'Scale' },
      { value: 'build_muscle', label: "Наростити м'язи", icon: 'Dumbbell' },
      { value: 'gain_weight', label: 'Набрати вагу', icon: 'TrendingUp' },
      { value: 'something_else', label: 'Просто харчуватись краще', icon: 'Utensils' },
    ],
  },
  {
    key: 'goal_promise',
    type: 'info',
    group: 'goal',
    title: 'Твій план уже вимальовується',
    stickyCta: true,
    image: { src: '/onboarding/kollaz.avif', alt: 'Колаж страв із меню Sytno' },
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
      { value: 'beginner', label: 'Тільки починаю — поясніть мені все', icon: 'Sprout' },
      { value: 'intermediate', label: 'Дещо знаю, хочу системності', icon: 'BookOpen' },
      {
        value: 'advanced',
        label: 'Розбираюсь, треба лише зручний інструмент',
        icon: 'GraduationCap',
      },
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
      {
        value: 'balanced_eating',
        label: 'Збалансовано харчуватися і жити здоровіше',
        icon: 'Salad',
      },
      { value: 'boost_energy', label: 'Підвищити енергію і настрій', icon: 'Zap' },
      {
        value: 'stay_motivated',
        label: 'Залишатися мотивованим і послідовним',
        icon: 'Target',
      },
      {
        value: 'better_body_image',
        label: 'Краще ставитися до свого тіла',
        icon: 'HeartHandshake',
      },
      {
        value: 'meal_planning',
        label: 'Не думати що приготувати завтра',
        icon: 'CalendarCheck',
      },
    ],
  },

  // ── Група B · Харчування ───────────────────────────────────────
  {
    key: 'breakfast_time',
    type: 'question',
    group: 'nutrition',
    title: 'Коли ти зазвичай снідаєш?',
    headerImage: { src: '/onboarding/breakfast.avif', alt: 'Сніданок із меню Sytno' },
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
    headerImage: { src: '/onboarding/lunch.avif', alt: 'Обід із меню Sytno' },
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
    headerImage: { src: '/onboarding/dinner.avif', alt: 'Вечеря з меню Sytno' },
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
    stickyCta: true,
    field: 'dietaryPreferences',
    options: [
      {
        value: 'none',
        label: 'Їм усе',
        description: 'Без обмежень',
        isNone: true,
        icon: 'Utensils',
      },
      {
        value: 'вегетаріанське',
        label: 'Вегетаріанське',
        description: "Без м'яса і риби",
        icon: 'Salad',
      },
      {
        value: 'веганське',
        label: 'Веганське',
        description: 'Без продуктів тваринного походження',
        icon: 'Sprout',
      },
      {
        value: 'кето',
        label: 'Кето',
        description: 'Мало вуглеводів, більше жирів',
        icon: 'EggFried',
      },
      {
        value: 'без глютену',
        label: 'Без глютену',
        description: 'Без пшениці, жита, ячменю',
        icon: 'WheatOff',
      },
      {
        value: 'без молочних',
        label: 'Без молочних',
        description: 'Без молока, сиру, йогурту',
        icon: 'MilkOff',
      },
      { value: 'без свинини', label: 'Без свинини', icon: 'Ham' },
      { value: 'без морепродуктів', label: 'Без морепродуктів', icon: 'FishOff' },
      {
        value: 'без цукру',
        label: 'Без цукру',
        description: 'Без доданого цукру',
        icon: 'CandyOff',
      },
    ],
  },
  {
    key: 'meal_card_demo',
    type: 'info',
    group: 'nutrition',
    title: 'Ось як виглядатиме твій день',
    body: 'Готове меню на день: страви, калорії та БЖВ — усе вже пораховано.',
    stickyCta: true,
    image: { src: '/onboarding/day-demo.avif', alt: 'Скрін меню на день у застосунку' },
  },
  {
    key: 'eating_habits',
    type: 'question',
    group: 'nutrition',
    title: 'Чи є в тебе такі звички?',
    questionType: 'multi',
    field: 'eatingHabits',
    options: [
      { value: 'emotional_eating', label: 'Заїдаю емоції або нудьгу', icon: 'Frown' },
      { value: 'overeating', label: 'Переїдаю', icon: 'HandPlatter' },
      { value: 'late_snacking', label: 'Перекушую пізно ввечері', icon: 'MoonStar' },
      {
        value: 'skipping_meals',
        label: 'Часто пропускаю прийоми їжі',
        icon: 'UtensilsCrossed',
      },
      { value: 'none', label: 'Нічого з переліченого', isNone: true, icon: 'Ban' },
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
      { value: 'sweets', label: 'Солодке', icon: 'Cookie' },
      { value: 'salty_snacks', label: 'Солоні снеки', icon: 'Popcorn' },
      { value: 'fast_food', label: 'Фастфуд', icon: 'Pizza' },
      { value: 'soda', label: 'Газована вода', icon: 'CupSoda' },
      { value: 'none', label: 'Нічого з переліченого', isNone: true, icon: 'Ban' },
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
    stickyCta: true,
    image: { src: '/onboarding/kbju-demo.avif', alt: 'Скрін підрахованих КБЖУ в застосунку' },
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
    title: 'Плани складають практики, а алгоритм по них працює',
  },

  // ── Група C · Тіло ─────────────────────────────────────────────
  {
    key: 'height',
    type: 'question',
    group: 'body',
    title: 'Який у тебе зріст?',
    questionType: 'number',
    stickyCta: true,
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
    stickyCta: true,
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
    stickyCta: true,
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
    stickyCta: true,
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
      {
        value: '1.2',
        label: 'Переважно сиджу',
        description: 'Офісна робота, мало руху',
        icon: 'Armchair',
      },
      {
        value: '1.375',
        label: 'Переважно стою',
        description: 'Вчитель, продавець-консультант',
        icon: 'PersonStanding',
      },
      {
        value: '1.55',
        label: 'Багато ходжу',
        description: "Кур'єр, офіціант, активний день",
        icon: 'Footprints',
      },
      {
        value: '1.725',
        label: 'Фізично важка робота',
        description: 'Будівництво, склад',
        icon: 'HardHat',
      },
      {
        value: '1.9',
        label: 'Дуже інтенсивні навантаження',
        description: 'Щоденні тренування або важка фізична праця',
        icon: 'Dumbbell',
      },
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
      { value: 'sure', label: 'Вірю, що впораюсь', icon: 'Flame' },
      { value: 'willing', label: 'Не впевнений, але спробую', icon: 'Smile' },
      { value: 'doubt', label: 'Чесно — сумніваюсь', icon: 'CircleHelp' },
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

/** Підписи груп кроків для хедера квізу. */
export const GROUP_LABELS: Record<StepGroup, string> = {
  goal: 'Мета',
  nutrition: 'Харчування',
  body: 'Тіло',
  finish: 'Фініш',
};

// Підписи варіантів більше не містять емодзі (їх замінили іконки lucide,
// поле Option.icon). Функція лишається запобіжником: «📉 Схуднути» →
// «Схуднути» для підписів зі старих збережених відповідей.
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
