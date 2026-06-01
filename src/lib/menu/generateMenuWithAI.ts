import OpenAI from 'openai';
import { UserProfile } from '@/types/userProfile';
import { AIMeal, DayMeals } from '@/types/meals';
import { MenuDay } from '@/types/weeklyMenu';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SEASON_HINTS: Record<string, string> = {
  winter: 'буряк, морква, капуста, яблука, хурма, броколі',
  spring: 'редиска, шпинат, зелена цибуля, кріп, салат',
  summer: 'помідори, огірки, кабачки, ягоди, перець, кукурудза',
  autumn: 'гарбуз, гриби, груші, слива, яблука, капуста',
};

function getSeason(month: number): string {
  if (month >= 12 || month <= 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  return 'autumn';
}

function getMonthName(month: number): string {
  const names = [
    '', 'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
  ];
  return names[month];
}

function calcMacros(goalCalories: number, sex: string) {
  const protein = Math.round(goalCalories * 0.3 / 4);
  const fat = Math.round(goalCalories * 0.25 / 9);
  const carbs = Math.round(goalCalories * 0.45 / 4);
  return { protein, fat, carbs };
}

function buildPrompt(profile: UserProfile, highRated: string[], lowRated: string[]): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const monthName = getMonthName(month);
  const season = getSeason(month);
  const seasonalHint = SEASON_HINTS[season];
  const macros = calcMacros(profile.goalCalories, profile.sex || 'female');

  return `Склади 7-денне меню для:
Стать: ${profile.sex === 'male' ? 'чоловік' : 'жінка'}, Вік: ${profile.ageYears}, Вага: ${profile.weightKg}кг, Зріст: ${profile.heightCm}см
Цільова калорійність раціону: ${profile.goalCalories} ккал/день — дотримуйся ТОЧНО (підлаштовуй вагу порцій, щоб сумарна калорійність дня = цьому значенню)
БЖВ цілі: ~${macros.protein}г білків / ~${macros.fat}г жирів / ~${macros.carbs}г вуглеводів
Мета: ${profile.mainGoal || 'схуднення'}
Поточний місяць: ${monthName} — пріоритизуй сезонні, недорогі продукти для України: ${seasonalHint}
${profile.favoriteFoods?.length ? `Улюблені продукти: ${profile.favoriteFoods.join(', ')}` : ''}
${profile.dislikedFoods?.length ? `НЕ включати: ${profile.dislikedFoods.join(', ')}` : ''}
${profile.dietaryPreferences?.length ? `Обмеження: ${profile.dietaryPreferences.join(', ')}` : ''}
${profile.allergies?.length ? `Алергії: ${profile.allergies.join(', ')}` : ''}
${highRated.length ? `Страви з хорошим рейтингом (повтори подібні): ${highRated.join(', ')}` : ''}
${lowRated.length ? `Страви з поганим рейтингом (не повторювати): ${lowRated.join(', ')}` : ''}
Якщо страва готується на 2-3 дні — позначити isMultiDayPrep: true, multiDayPrepDays: N.
Для кожної страви обов'язково вкажи servingSize (вагу однієї порції в грамах); калорійність і БЖВ мають відповідати саме цій вазі, а сума ваг інгредієнтів ≈ servingSize.

ВАЖЛИВО: Поверни РІВНО 7 днів (Понеділок–Неділя). Відповідь — ТІЛЬКИ валідний JSON без markdown-обгортки та пояснень. Суворо дотримуйся наданої схеми.`;
}

// Persona + nutrition rules, shared by the weekly-menu and meal-alternatives calls.
// Kept in English (proven base prompt); the model still must output Ukrainian text.
const DIETITIAN_PERSONA = `You are an AI dietitian. Build a healthy, balanced menu tailored to the user's data and preferences supplied in the user message.

CALORIES (most important):
- The user message states the target daily calorie intake. Hit that number for the whole day.
- Distribute calories so that about 80% fall in the first half of the day (breakfast + lunch + daytime snack) and about 20% on dinner.
- Strictly respect the daily calorie target, do not drift. If a draft day totals too many calories, redo the SAME day with smaller portions; if too few, increase the portions — until the day's total matches the target.
- Never plan below 1200 kcal/day.

PORTION WEIGHT (critical for calorie accuracy):
- For every dish set "servingSize" to the cooked weight of ONE portion in grams.
- "calories", "protein", "fat", "carbs" MUST correspond to eating exactly that servingSize — more grams means more calories. Keep them mutually consistent.
- Each ingredient "quantity" is its weight (or count) for one portion; the ingredient weights must add up to the dish servingSize.

NUTRITION:
- Varied menu covering all food groups (proteins, fats, carbohydrates, vitamins, minerals).
- Prefer inexpensive products typical for Ukraine; prioritize the seasonal products named in the user message.
- Never put incompatible foods in the same meal (e.g. milk + cucumber).

DISHES:
- Every dish "name" must be 30 characters or fewer.
- Give each dish a fitting food "emoji".
- Write a step-by-step chef-style recipe in "description" when the dish has 3+ ingredients OR any ingredient requires heat treatment (boiling, frying, stewing, baking). Number each step and separate them with \n (newline). For simple ready-to-eat foods (fresh fruit, nuts, plain yoghurt) a single short sentence is enough.

OUTPUT LANGUAGE:
- ALL text values (name, description, ingredient name) MUST be written in Ukrainian.
- Do not ask the user questions and do not add alternatives, notes or commentary outside the JSON.`;

const SYSTEM_PROMPT = `${DIETITIAN_PERSONA}

WEEKLY MENU TASK:
- Always return EXACTLY 7 days of the week (Понеділок–Неділя).
- Each day: breakfast (1–2 dishes), lunch (2–3 dishes), dinner (2–3 dishes), snacks (1 dish).
- breakfast, lunch, dinner and snacks are ALL JSON ARRAYS — even when there is only one dish.
- Reply with ONLY valid JSON, no markdown wrapper and no explanations, exactly matching this schema:
{
  "days": [
    {
      "dayLabel": "Понеділок",
      "meals": {
        "breakfast": [{ "name": "...", "calories": 0, "protein": 0, "fat": 0, "carbs": 0, "servingSize": 0, "servings": 1, "emoji": "🥣", "description": "...", "ingredients": [{"name": "...", "quantity": 0, "unit": "г", "shoppingCategory": "grains"}], "prepTimeMinutes": 0, "cookTimeMinutes": 0, "isMultiDayPrep": false, "multiDayPrepDays": 0, "difficulty": "easy" }],
        "lunch": [{ ...same structure... }],
        "dinner": [{ ...same structure... }],
        "snacks": [{ ...same structure... }]
      }
    }
  ]
}
shoppingCategory values: vegetables|fruits|meat|fish|dairy|grains|legumes|oils|spices|other
difficulty values: easy|medium|hard

## EXAMPLE — one correctly formatted day (all 7 days must follow this exact pattern):
{"dayLabel":"Понеділок","meals":{"breakfast":[{"name":"Вівсянка з молоком","calories":290,"protein":10,"fat":6,"carbs":48,"servingSize":280,"servings":1,"emoji":"🥣","description":"Вівсяну крупу варити на молоці 8–10 хв, посолити за смаком.","ingredients":[{"name":"вівсяна крупа","quantity":80,"unit":"г","shoppingCategory":"grains"},{"name":"молоко 2.5%","quantity":200,"unit":"мл","shoppingCategory":"dairy"}],"prepTimeMinutes":2,"cookTimeMinutes":10,"isMultiDayPrep":false,"multiDayPrepDays":0,"difficulty":"easy"},{"name":"Яблуко","calories":80,"protein":0,"fat":0,"carbs":21,"servingSize":150,"servings":1,"emoji":"🍎","description":"Свіже яблуко.","ingredients":[{"name":"яблуко","quantity":150,"unit":"г","shoppingCategory":"fruits"}],"prepTimeMinutes":0,"cookTimeMinutes":0,"isMultiDayPrep":false,"multiDayPrepDays":0,"difficulty":"easy"}],"lunch":[{"name":"Тушковане куряче філе з овочами","calories":380,"protein":35,"fat":13,"carbs":22,"servingSize":380,"servings":1,"emoji":"🍗","description":"Рецепт (1 порція):\\n1. Нарізати куряче філе кубиками 2–3 см, цибулю та перець — довільно.\\n2. Розігріти олію на середньому вогні, обсмажити філе 3–4 хв до золотавого кольору.\\n3. Додати овочі, посолити, поперчити, тушкувати 5 хв помішуючи.\\n4. Влити 2 ст.л. води, накрити кришкою та тушкувати ще 15 хв.\\nПодавати гарячим.","ingredients":[{"name":"куряче філе","quantity":150,"unit":"г","shoppingCategory":"meat"},{"name":"болгарський перець","quantity":100,"unit":"г","shoppingCategory":"vegetables"},{"name":"цибуля","quantity":60,"unit":"г","shoppingCategory":"vegetables"},{"name":"олія соняшникова","quantity":10,"unit":"мл","shoppingCategory":"oils"},{"name":"сіль, перець","quantity":2,"unit":"г","shoppingCategory":"spices"}],"prepTimeMinutes":8,"cookTimeMinutes":20,"isMultiDayPrep":false,"multiDayPrepDays":0,"difficulty":"medium"},{"name":"Листовий салат","calories":45,"protein":2,"fat":1,"carbs":7,"servingSize":120,"servings":1,"emoji":"🥗","description":"Промити листя, нарвати на шматки, посолити та збризнути лимонним соком.","ingredients":[{"name":"мікс листових","quantity":100,"unit":"г","shoppingCategory":"vegetables"},{"name":"лимонний сік","quantity":10,"unit":"мл","shoppingCategory":"other"}],"prepTimeMinutes":3,"cookTimeMinutes":0,"isMultiDayPrep":false,"multiDayPrepDays":0,"difficulty":"easy"}],"dinner":[{"name":"Куряче філе на грилі","calories":220,"protein":38,"fat":6,"carbs":0,"servingSize":170,"servings":1,"emoji":"🥩","description":"Рецепт:\\n1. Куряче філе відбити, натерти сіллю та паприкою.\\n2. Смажити на гриль-сковороді 4–5 хв з кожного боку до золотавої скоринки.\\nПодавати з кашею.","ingredients":[{"name":"куряче філе","quantity":150,"unit":"г","shoppingCategory":"meat"},{"name":"паприка, сіль","quantity":2,"unit":"г","shoppingCategory":"spices"},{"name":"олія","quantity":5,"unit":"мл","shoppingCategory":"oils"}],"prepTimeMinutes":3,"cookTimeMinutes":10,"isMultiDayPrep":false,"multiDayPrepDays":0,"difficulty":"easy"},{"name":"Гречана каша","calories":165,"protein":6,"fat":2,"carbs":33,"servingSize":200,"servings":1,"emoji":"🌾","description":"Рецепт:\\n1. Промити гречку, залити водою 1:2.\\n2. Варити 15–20 хв до готовності, посолити.","ingredients":[{"name":"гречана крупа","quantity":80,"unit":"г","shoppingCategory":"grains"},{"name":"вода","quantity":160,"unit":"мл","shoppingCategory":"other"}],"prepTimeMinutes":2,"cookTimeMinutes":20,"isMultiDayPrep":true,"multiDayPrepDays":2,"difficulty":"easy"}],"snacks":[{"name":"Йогурт натуральний","calories":110,"protein":6,"fat":3,"carbs":15,"servingSize":180,"servings":1,"emoji":"🥛","description":"Натуральний йогурт без добавок.","ingredients":[{"name":"йогурт натуральний","quantity":180,"unit":"г","shoppingCategory":"dairy"}],"prepTimeMinutes":0,"cookTimeMinutes":0,"isMultiDayPrep":false,"multiDayPrepDays":0,"difficulty":"easy"}]}}`;

const ALT_SYSTEM_PROMPT = `${DIETITIAN_PERSONA}

SINGLE-MEAL TASK:
- You will be asked for a few alternative dishes for ONE meal slot. Reply with ONLY valid JSON of the exact shape requested in the user message, no markdown wrapper and no commentary.`;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// gpt-4o supports up to 16384 output tokens. A full 7-day menu (4 meals/day with
// Ukrainian recipes) needs the headroom — 8000 truncated the JSON and the model
// silently returned fewer days.
const MAX_OUTPUT_TOKENS = 16384;

async function callOpenAI(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  maxTokens: number,
): Promise<{ content: string; finishReason: string | null }> {
  const response = await openai.chat.completions.create({
    // gpt-4.1-mini: faster + cheaper than gpt-4o, comparable quality for this task.
    model: 'gpt-4.1-mini',
    messages,
    max_tokens: maxTokens,
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });
  const choice = response.choices[0];
  return {
    content: choice.message.content ?? '',
    finishReason: choice.finish_reason ?? null,
  };
}

function normalizeMeal(raw: Record<string, unknown>, defaults: Partial<AIMeal> = {}): AIMeal {
  return {
    name: String(raw.name ?? ''),
    calories: Number(raw.calories ?? 0),
    protein: Number(raw.protein ?? 0),
    fat: Number(raw.fat ?? 0),
    carbs: Number(raw.carbs ?? 0),
    servingSize: Number(raw.servingSize ?? 200),
    servings: Number(raw.servings ?? 1),
    emoji: String(raw.emoji ?? '🍽️'),
    description: String(raw.description ?? ''),
    ingredients: Array.isArray(raw.ingredients) ? (raw.ingredients as Record<string, unknown>[]).map((i) => ({
      name: String(i.name ?? ''),
      quantity: Number(i.quantity ?? 0),
      unit: String(i.unit ?? 'г'),
      shoppingCategory: (i.shoppingCategory as AIMeal['ingredients'][0]['shoppingCategory']) ?? 'other',
    })) : [],
    prepTimeMinutes: Number(raw.prepTimeMinutes ?? 10),
    cookTimeMinutes: Number(raw.cookTimeMinutes ?? 10),
    isMultiDayPrep: Boolean(raw.isMultiDayPrep),
    multiDayPrepDays: Number(raw.multiDayPrepDays ?? 0),
    difficulty: (['easy', 'medium', 'hard'].includes(String(raw.difficulty)) ? raw.difficulty : 'easy') as AIMeal['difficulty'],
    isSwapped: false,
    originalMealSnapshot: null,
    quickAlternatives: Array.isArray(raw.quickAlternatives)
      ? (raw.quickAlternatives as Record<string, unknown>[]).map((a) => normalizeMeal(a))
      : [],
    isConsumed: false,
    consumedAt: null,
    consumedWeight: null,
    rating: null,
    ratedAt: null,
    ...defaults,
  };
}

const DAY_LABELS = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця', 'Субота', 'Неділя'];

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function normalizeArray(raw: unknown): AIMeal[] {
  if (Array.isArray(raw)) return raw.map((m) => normalizeMeal(m as Record<string, unknown>));
  if (raw && typeof raw === 'object') return [normalizeMeal(raw as Record<string, unknown>)];
  return [normalizeMeal({})];
}

function mapDays(rawDays: Record<string, unknown>[], weekStartDate: Date): MenuDay[] {
  return rawDays.slice(0, 7).map((d, i) => {
    const rawMeals = (d.meals || {}) as Record<string, unknown>;
    const breakfast = normalizeArray(rawMeals.breakfast);
    const lunch = normalizeArray(rawMeals.lunch);
    const dinner = normalizeArray(rawMeals.dinner);
    const snacks = normalizeArray(rawMeals.snacks);

    const allMeals = [...breakfast, ...lunch, ...dinner, ...snacks];
    const totalCalories = allMeals.reduce((s, m) => s + m.calories * m.servings, 0);
    const totalPrepMinutes = allMeals.reduce((s, m) => s + m.prepTimeMinutes + m.cookTimeMinutes, 0);

    const date = new Date(weekStartDate);
    date.setDate(weekStartDate.getDate() + i);

    return {
      date,
      dayLabel: String(d.dayLabel ?? DAY_LABELS[i]),
      meals: { breakfast, lunch, dinner, snacks },
      totalCalories,
      totalPrepMinutes,
      isCompleted: false,
      completedAt: null,
    };
  });
}

export async function generateMenuWithAI(
  profile: UserProfile,
  highRatedMeals: string[] = [],
  lowRatedMeals: string[] = [],
): Promise<{ days: MenuDay[]; weekStartDate: Date }> {
  const prompt = buildPrompt(profile, highRatedMeals, lowRatedMeals);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];

  const weekStartDate = getWeekStart();
  let lastError: Error | null = null;

  // Retry the whole attempt (call → parse → validate) so a truncated or
  // short response (the "menu only has one day" bug) triggers a fresh try.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { content, finishReason } = await callOpenAI(messages, MAX_OUTPUT_TOKENS);

      if (finishReason === 'length') {
        throw new Error('AI response truncated (hit token limit) — incomplete menu');
      }

      const parsed = JSON.parse(content) as { days?: Record<string, unknown>[] };

      if (!Array.isArray(parsed.days) || parsed.days.length < 7) {
        throw new Error(`AI returned ${parsed.days?.length ?? 0} days, expected 7`);
      }

      return { days: mapDays(parsed.days, weekStartDate), weekStartDate };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await sleep(1000 * Math.pow(2, attempt));
    }
  }

  throw lastError ?? new Error('Failed to generate menu');
}

/**
 * Generates fresh alternatives for a single meal on demand (used by the swap flow).
 * Alternatives are no longer pre-generated with the weekly menu — that bloated the
 * response and forced the model to truncate the 7-day plan.
 */
export async function generateMealAlternatives(
  profile: UserProfile,
  meal: AIMeal,
  count = 3,
): Promise<AIMeal[]> {
  const constraints = [
    profile.dislikedFoods?.length ? `НЕ включати: ${profile.dislikedFoods.join(', ')}` : '',
    profile.dietaryPreferences?.length ? `Обмеження: ${profile.dietaryPreferences.join(', ')}` : '',
    profile.allergies?.length ? `Алергії: ${profile.allergies.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `Запропонуй ${count} альтернативні страви на заміну "${meal.name}" (${meal.calories} ккал, ${meal.servingSize} г).
Та сама категорія прийому їжі, калорійність у межах ±10% (${Math.round(meal.calories * 0.9)}–${Math.round(meal.calories * 1.1)} ккал).
Для кожної страви вкажи servingSize (вагу порції в г); калорійність має відповідати цій вазі.
Мова: українська. Реальні, різноманітні страви.
${constraints}
Відповідь — ТІЛЬКИ валідний JSON: { "alternatives": [ <AIMeal>, ... ] } з ${count} елементами.`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: ALT_SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { content, finishReason } = await callOpenAI(messages, 4000);
      if (finishReason === 'length') throw new Error('Alternatives response truncated');
      const parsed = JSON.parse(content) as { alternatives?: Record<string, unknown>[] };
      if (!Array.isArray(parsed.alternatives) || parsed.alternatives.length === 0) {
        throw new Error('AI returned no alternatives');
      }
      return parsed.alternatives.slice(0, count).map((a) => normalizeMeal(a));
    } catch (err) {
      if (attempt >= 2) throw err instanceof Error ? err : new Error(String(err));
      await sleep(1000 * Math.pow(2, attempt));
    }
  }

  return [];
}
