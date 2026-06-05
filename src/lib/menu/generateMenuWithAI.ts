import OpenAI from 'openai';
import { UserProfile } from '@/types/userProfile';
import { AIMeal, DayMeals } from '@/types/meals';
import { MenuDay } from '@/types/weeklyMenu';
import { computeMealNutrition } from './foodNutrition';

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

function buildPrompt(profile: UserProfile, highRated: string[], lowRated: string[]): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const monthName = getMonthName(month);
  const season = getSeason(month);
  const seasonalHint = SEASON_HINTS[season];

  return `Склади 7-денне меню для:
Стать: ${profile.sex === 'male' ? 'чоловік' : 'жінка'}, Вік: ${profile.ageYears}, Вага: ${profile.weightKg}кг, Зріст: ${profile.heightCm}см
Орієнтовна калорійність: ~${profile.goalCalories} ккал/день (орієнтир для розміру порцій; точний розрахунок виконується автоматично)
Мета: ${profile.mainGoal || 'схуднення'}
Поточний місяць: ${monthName} — пріоритизуй сезонні, недорогі продукти для України: ${seasonalHint}
${profile.favoriteFoods?.length ? `Улюблені продукти: ${profile.favoriteFoods.join(', ')}` : ''}
${profile.dislikedFoods?.length ? `НЕ включати: ${profile.dislikedFoods.join(', ')}` : ''}
${profile.dietaryPreferences?.length ? `Обмеження: ${profile.dietaryPreferences.join(', ')}` : ''}
${profile.allergies?.length ? `Алергії: ${profile.allergies.join(', ')}` : ''}
${highRated.length ? `Страви з хорошим рейтингом (повтори подібні): ${highRated.join(', ')}` : ''}
${lowRated.length ? `Страви з поганим рейтингом (не повторювати): ${lowRated.join(', ')}` : ''}
Якщо страва готується на 2-3 дні — позначити isMultiDayPrep: true, multiDayPrepDays: N.
Для кожної страви вкажи servingSize (вагу готової порції в грамах); сума ваг інгредієнтів має приблизно відповідати servingSize.

ВАЖЛИВО: Поверни РІВНО 7 днів (Понеділок–Неділя). Відповідь — ТІЛЬКИ валідний JSON без markdown-обгортки та пояснень. Суворо дотримуйся наданої схеми.`;
}

// Persona + nutrition rules, shared by the weekly-menu and meal-alternatives calls.
// Kept in English (proven base prompt); the model still must output Ukrainian text.
const DIETITIAN_PERSONA = `You are an AI dietitian. Build a healthy, balanced menu tailored to the user's data and preferences supplied in the user message.

PORTION SIZING:
- Use the target daily calorie value in the user message only as a rough guide for sizing portions sensibly.
- You do NOT need to calculate, verify, or output any calorie or macro numbers — that is handled entirely by the application from the ingredient list.
- Focus on: nutritional variety, seasonal/local ingredients, recipe quality, realistic cooking steps.

NUTRITION:
- Varied menu covering all food groups (proteins, fats, carbohydrates, vitamins, minerals).
- Prefer inexpensive products typical for Ukraine; prioritize the seasonal products named in the user message.
- Never put incompatible foods in the same meal (e.g. milk + cucumber).
- If the user's favorite foods include fast food, confectionery, pastry, fried snacks, or other high-calorie processed items: you MAY include them, but their combined daily caloric contribution must not exceed 20% of the target intake.

MEAL STRUCTURE (mandatory):
- The FIRST dish in breakfast, lunch, and dinner MUST feature a substantial protein source: meat, fish, eggs, cottage cheese, hard cheese, yogurt (≥100 g), or cooked legumes. A plain fruit, bread, or pure-starch dish is NEVER the first dish of a main meal.
- Lunch MUST include at least one dedicated side dish of cooked grains or pasta as a separate dish (buckwheat, rice, pasta, millet, pearl barley, bulgur, polenta, etc.) — in addition to the main protein dish. This ensures adequate calorie density and satiety.
- Snack (1 dish only): can be fruit, dairy, nuts, or a light whole-grain item.

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
        "breakfast": [{ "name": "...", "servingSize": 0, "servings": 1, "emoji": "🥣", "description": "...", "ingredients": [{"name": "...", "quantity": 0, "unit": "г", "shoppingCategory": "grains"}], "prepTimeMinutes": 0, "cookTimeMinutes": 0, "isMultiDayPrep": false, "multiDayPrepDays": 0, "difficulty": "easy" }],
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
{"dayLabel":"Понеділок","meals":{"breakfast":[{"name":"Вівсянка з молоком","servingSize":280,"servings":1,"emoji":"🥣","description":"Вівсяну крупу варити на молоці 8–10 хв, посолити за смаком.","ingredients":[{"name":"вівсяна крупа","quantity":80,"unit":"г","shoppingCategory":"grains"},{"name":"молоко 2.5%","quantity":200,"unit":"мл","shoppingCategory":"dairy"}],"prepTimeMinutes":2,"cookTimeMinutes":10,"isMultiDayPrep":false,"multiDayPrepDays":0,"difficulty":"easy"},{"name":"Яблуко","servingSize":150,"servings":1,"emoji":"🍎","description":"Свіже яблуко.","ingredients":[{"name":"яблуко","quantity":150,"unit":"г","shoppingCategory":"fruits"}],"prepTimeMinutes":0,"cookTimeMinutes":0,"isMultiDayPrep":false,"multiDayPrepDays":0,"difficulty":"easy"}],"lunch":[{"name":"Тушковане куряче філе з овочами","servingSize":380,"servings":1,"emoji":"🍗","description":"Рецепт (1 порція):\\n1. Нарізати куряче філе кубиками 2–3 см, цибулю та перець — довільно.\\n2. Розігріти олію на середньому вогні, обсмажити філе 3–4 хв до золотавого кольору.\\n3. Додати овочі, посолити, поперчити, тушкувати 5 хв помішуючи.\\n4. Влити 2 ст.л. води, накрити кришкою та тушкувати ще 15 хв.\\nПодавати гарячим.","ingredients":[{"name":"куряче філе","quantity":150,"unit":"г","shoppingCategory":"meat"},{"name":"болгарський перець","quantity":100,"unit":"г","shoppingCategory":"vegetables"},{"name":"цибуля","quantity":60,"unit":"г","shoppingCategory":"vegetables"},{"name":"олія соняшникова","quantity":10,"unit":"мл","shoppingCategory":"oils"},{"name":"сіль, перець","quantity":2,"unit":"г","shoppingCategory":"spices"}],"prepTimeMinutes":8,"cookTimeMinutes":20,"isMultiDayPrep":false,"multiDayPrepDays":0,"difficulty":"medium"},{"name":"Листовий салат","servingSize":120,"servings":1,"emoji":"🥗","description":"Промити листя, нарвати на шматки, посолити та збризнути лимонним соком.","ingredients":[{"name":"мікс листових","quantity":100,"unit":"г","shoppingCategory":"vegetables"},{"name":"лимонний сік","quantity":10,"unit":"мл","shoppingCategory":"other"}],"prepTimeMinutes":3,"cookTimeMinutes":0,"isMultiDayPrep":false,"multiDayPrepDays":0,"difficulty":"easy"}],"dinner":[{"name":"Куряче філе на грилі","servingSize":170,"servings":1,"emoji":"🥩","description":"Рецепт:\\n1. Куряче філе відбити, натерти сіллю та паприкою.\\n2. Смажити на гриль-сковороді 4–5 хв з кожного боку до золотавої скоринки.\\nПодавати з кашею.","ingredients":[{"name":"куряче філе","quantity":150,"unit":"г","shoppingCategory":"meat"},{"name":"паприка, сіль","quantity":2,"unit":"г","shoppingCategory":"spices"},{"name":"олія","quantity":5,"unit":"мл","shoppingCategory":"oils"}],"prepTimeMinutes":3,"cookTimeMinutes":10,"isMultiDayPrep":false,"multiDayPrepDays":0,"difficulty":"easy"},{"name":"Гречана каша","servingSize":200,"servings":1,"emoji":"🌾","description":"Рецепт:\\n1. Промити гречку, залити водою 1:2.\\n2. Варити 15–20 хв до готовності, посолити.","ingredients":[{"name":"гречана крупа","quantity":80,"unit":"г","shoppingCategory":"grains"},{"name":"вода","quantity":160,"unit":"мл","shoppingCategory":"other"}],"prepTimeMinutes":2,"cookTimeMinutes":20,"isMultiDayPrep":true,"multiDayPrepDays":2,"difficulty":"easy"}],"snacks":[{"name":"Йогурт натуральний","servingSize":180,"servings":1,"emoji":"🥛","description":"Натуральний йогурт без добавок.","ingredients":[{"name":"йогурт натуральний","quantity":180,"unit":"г","shoppingCategory":"dairy"}],"prepTimeMinutes":0,"cookTimeMinutes":0,"isMultiDayPrep":false,"multiDayPrepDays":0,"difficulty":"easy"}]}}`;

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
  const ingredients = Array.isArray(raw.ingredients)
    ? (raw.ingredients as Record<string, unknown>[]).map((i) => ({
        name: String(i.name ?? ''),
        quantity: Number(i.quantity ?? 0),
        unit: String(i.unit ?? 'г'),
        shoppingCategory: (i.shoppingCategory as AIMeal['ingredients'][0]['shoppingCategory']) ?? 'other',
      }))
    : [];

  const computed = computeMealNutrition(ingredients);

  return {
    name: String(raw.name ?? ''),
    calories: computed.calories,
    protein: computed.protein,
    fat: computed.fat,
    carbs: computed.carbs,
    servingSize: Number(raw.servingSize ?? 200),
    servings: Number(raw.servings ?? 1),
    emoji: String(raw.emoji ?? '🍽️'),
    description: String(raw.description ?? ''),
    ingredients,
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

// Scales all meals in a day so the daily calorie total matches targetCalories
// within ±3%. Applies a uniform factor k to macros, servingSize, and ingredient
// quantities — preserving the macro ratio and kcal/g consistency.
function scaleDayToTarget(meals: DayMeals, targetCalories: number): void {
  const allMeals = [...meals.breakfast, ...meals.lunch, ...meals.dinner, ...meals.snacks];
  const dayTotal = allMeals.reduce((s, m) => s + m.calories * m.servings, 0);

  if (dayTotal === 0) return;

  let k = targetCalories / dayTotal;
  if (Math.abs(k - 1) <= 0.03) return; // already within ±3%

  if (k < 0.5 || k > 2.0) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[scaleDayToTarget] extreme scale factor k=${k.toFixed(2)}, clamping to [0.5, 2.0]`);
    }
    k = Math.max(0.5, Math.min(2.0, k));
  }

  for (const meal of allMeals) {
    meal.calories   = Math.round(meal.calories   * k);
    meal.protein    = Math.round(meal.protein    * k);
    meal.fat        = Math.round(meal.fat        * k);
    meal.carbs      = Math.round(meal.carbs      * k);
    meal.servingSize = Math.round(meal.servingSize * k);
    meal.ingredients = meal.ingredients.map((ing) => ({
      ...ing,
      quantity: ing.unit === 'шт'
        ? Math.max(1, Math.round(ing.quantity * k))
        : Math.max(5, Math.round(ing.quantity * k)),
    }));
  }
}

// When a day is still severely deficient after scaling (because many ingredients
// were unknown → near-zero computed calories → k was clamped at 2.0), borrows
// the lowest-calorie dish from another day's same meal slot — but only if
// that donor has ≥2 dishes there and the current day has just 1. Priority:
// adjacent days first, then any other day. The borrowed dish is a copy; the
// donor is left unchanged. After borrowing, the day is re-scaled so the total
// stays within ±3%.
function adjustDeficientDays(days: MenuDay[], targetCalories: number): void {
  const SEVERE_DEFICIT = 0.88; // still below 88% of target after scaling
  const MEAL_SLOTS: (keyof DayMeals)[] = ['lunch', 'breakfast', 'dinner'];

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const allMeals = [...day.meals.breakfast, ...day.meals.lunch, ...day.meals.dinner, ...day.meals.snacks];
    const dayTotal = allMeals.reduce((s, m) => s + m.calories * m.servings, 0);

    if (dayTotal >= targetCalories * SEVERE_DEFICIT) continue;

    let borrowed = false;

    for (const slot of MEAL_SLOTS) {
      if (day.meals[slot].length >= 2) continue; // already has 2 dishes here

      // Search: adjacent days first, then all others
      const orderedIdxs = [i - 1, i + 1, ...Array.from({ length: days.length }, (_, j) => j)]
        .filter((j, pos, arr) => j >= 0 && j < days.length && j !== i && arr.indexOf(j) === pos);

      for (const ni of orderedIdxs) {
        const neighborSlot = days[ni].meals[slot];
        if (neighborSlot.length < 2) continue;

        // Copy the smallest-calorie dish (side / salad) from the donor
        const sorted = [...neighborSlot].sort((a, b) => a.calories - b.calories);
        day.meals[slot].push({
          ...sorted[0],
          isConsumed: false,
          consumedAt: null,
          consumedWeight: null,
          rating: null,
          ratedAt: null,
        });
        borrowed = true;
        break;
      }
      if (borrowed) break;
    }

    if (borrowed) scaleDayToTarget(day.meals, targetCalories);
  }
}

function mapDays(rawDays: Record<string, unknown>[], weekStartDate: Date, targetCalories: number): MenuDay[] {
  // Pass 1 — normalize: parse LLM output + compute macros from ingredient lookup table
  const days: MenuDay[] = rawDays.slice(0, 7).map((d, i) => {
    const rawMeals = (d.meals || {}) as Record<string, unknown>;
    const date = new Date(weekStartDate);
    date.setDate(weekStartDate.getDate() + i);
    return {
      date,
      dayLabel: String(d.dayLabel ?? DAY_LABELS[i]),
      meals: {
        breakfast: normalizeArray(rawMeals.breakfast),
        lunch:     normalizeArray(rawMeals.lunch),
        dinner:    normalizeArray(rawMeals.dinner),
        snacks:    normalizeArray(rawMeals.snacks),
      },
      totalCalories: 0,
      totalPrepMinutes: 0,
      isCompleted: false,
      completedAt: null,
    };
  });

  // Pass 2 — scale each day to the calorie target (uniform k factor)
  for (const day of days) scaleDayToTarget(day.meals, targetCalories);

  // Pass 3 — for days still severely deficient (k was clamped), borrow a dish
  //          from a neighboring day and re-scale
  adjustDeficientDays(days, targetCalories);

  // Pass 4 — compute final aggregate totals
  for (const day of days) {
    const allMeals = [...day.meals.breakfast, ...day.meals.lunch, ...day.meals.dinner, ...day.meals.snacks];
    day.totalCalories    = allMeals.reduce((s, m) => s + m.calories    * m.servings, 0);
    day.totalPrepMinutes = allMeals.reduce((s, m) => s + m.prepTimeMinutes + m.cookTimeMinutes, 0);
  }

  return days;
}

export async function generateMenuWithAI(
  profile: UserProfile,
  highRatedMeals: string[] = [],
  lowRatedMeals: string[] = [],
  options: { maxAttempts?: number } = {},
): Promise<{ days: MenuDay[]; weekStartDate: Date }> {
  const maxAttempts = options.maxAttempts ?? 3;
  const prompt = buildPrompt(profile, highRatedMeals, lowRatedMeals);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];

  const weekStartDate = getWeekStart();
  let lastError: Error | null = null;

  // Retry the whole attempt (call → parse → validate) so a truncated or
  // short response (the "menu only has one day" bug) triggers a fresh try.
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { content, finishReason } = await callOpenAI(messages, MAX_OUTPUT_TOKENS);

      if (finishReason === 'length') {
        throw new Error('AI response truncated (hit token limit) — incomplete menu');
      }

      const parsed = JSON.parse(content) as { days?: Record<string, unknown>[] };

      if (!Array.isArray(parsed.days) || parsed.days.length < 7) {
        throw new Error(`AI returned ${parsed.days?.length ?? 0} days, expected 7`);
      }

      return { days: mapDays(parsed.days, weekStartDate, profile.goalCalories), weekStartDate };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) await sleep(1000 * Math.pow(2, attempt));
    }
  }

  throw lastError ?? new Error('Failed to generate menu');
}

/**
 * Scales a meal's macros and ingredient quantities so its calories match
 * targetCalories within ±3%. Mutates the meal in place. No-ops when either
 * value is 0 or the factor is outside the safe [0.5, 2.0] range.
 */
export function scaleMealToCalories(meal: AIMeal, targetCalories: number): void {
  if (targetCalories <= 0 || meal.calories <= 0) return;
  const k = targetCalories / meal.calories;
  if (Math.abs(k - 1) <= 0.03 || k < 0.5 || k > 2.0) return;

  meal.calories    = Math.round(meal.calories    * k);
  meal.protein     = Math.round(meal.protein     * k);
  meal.fat         = Math.round(meal.fat         * k);
  meal.carbs       = Math.round(meal.carbs       * k);
  meal.servingSize = Math.round(meal.servingSize * k);
  meal.ingredients = meal.ingredients.map((ing) => ({
    ...ing,
    quantity: ing.unit === 'шт'
      ? Math.max(1, Math.round(ing.quantity * k))
      : Math.max(5, Math.round(ing.quantity * k)),
  }));
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

  const targetCalories = meal.calories > 0 ? meal.calories : null;
  const calorieInstruction = targetCalories
    ? `Цільова калорійність однієї порції: ~${targetCalories} ккал. Підбирай та регулюй вагу інгредієнтів у грамах так, щоб сума калорій кожної страви максимально відповідала цій цілі.`
    : `Орієнтовний розмір порції: ~${meal.servingSize}г.`;

  const prompt = `Запропонуй ${count} альтернативні страви на заміну "${meal.name}".
Та сама категорія прийому їжі. Мова: українська. Реальні, різноманітні страви.
${calorieInstruction}
${constraints}
Відповідь — ТІЛЬКИ валідний JSON без markdown та коментарів:
{ "alternatives": [ { "name": "...", "servingSize": 0, "servings": 1, "emoji": "🍽️", "description": "...", "ingredients": [{"name": "...", "quantity": 0, "unit": "г", "shoppingCategory": "other"}], "prepTimeMinutes": 0, "cookTimeMinutes": 0, "isMultiDayPrep": false, "multiDayPrepDays": 0, "difficulty": "easy" } ] }
shoppingCategory values: vegetables|fruits|meat|fish|dairy|grains|legumes|oils|spices|other
difficulty values: easy|medium|hard
ОБОВ'ЯЗКОВО: кожна страва повинна мати масив ingredients з усіма складниками та їх кількістю.
Рівно ${count} елементів у масиві alternatives.`;

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
      return parsed.alternatives.slice(0, count).map((a) => {
        const alt = normalizeMeal(a);
        scaleMealToCalories(alt, meal.calories);
        return alt;
      });
    } catch (err) {
      if (attempt >= 2) throw err instanceof Error ? err : new Error(String(err));
      await sleep(1000 * Math.pow(2, attempt));
    }
  }

  return [];
}
