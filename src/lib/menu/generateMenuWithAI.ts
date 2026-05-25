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

  return `Склади 7-денне меню (сніданок, обід, вечеря, 1 перекус) для:
Стать: ${profile.sex === 'male' ? 'чоловік' : 'жінка'}, Вік: ${profile.ageYears}, Вага: ${profile.weightKg}кг, Зріст: ${profile.heightCm}см
Цільова калорійність: ~${profile.goalCalories} ккал/день (±10%)
БЖВ цілі: ~${macros.protein}г білків / ~${macros.fat}г жирів / ~${macros.carbs}г вуглеводів
Мета: ${profile.mainGoal || 'схуднення'}
Поточний місяць: ${monthName} — пріоритизуй сезонні продукти для України: ${seasonalHint}
${profile.favoriteFoods?.length ? `Улюблені продукти: ${profile.favoriteFoods.join(', ')}` : ''}
${profile.dislikedFoods?.length ? `НЕ включати: ${profile.dislikedFoods.join(', ')}` : ''}
${profile.dietaryPreferences?.length ? `Обмеження: ${profile.dietaryPreferences.join(', ')}` : ''}
${profile.allergies?.length ? `Алергії: ${profile.allergies.join(', ')}` : ''}
${highRated.length ? `Страви з хорошим рейтингом (повтори подібні): ${highRated.join(', ')}` : ''}
${lowRated.length ? `Страви з поганим рейтингом (не повторювати): ${lowRated.join(', ')}` : ''}
Якщо страва готується на 2-3 дні — позначити isMultiDayPrep: true, multiDayPrepDays: N.

ВАЖЛИВО: Поверни РІВНО 7 днів (Понеділок–Неділя). Відповідь — ТІЛЬКИ валідний JSON без markdown-обгортки та пояснень. Суворо дотримуйся наданої схеми.`;
}

const SYSTEM_PROMPT = `Ти — досвідчений дієтолог-нутриціолог. Складаєш персоналізовані меню для схуднення.
Мова відповіді: ВИКЛЮЧНО українська.
Дотримуйся принципу безпечного схуднення: різноманітне харчування, реальні страви, мінімум 1200 ккал/день.
Завжди повертай РІВНО 7 днів тижня (Понеділок–Неділя).
Відповідай ТІЛЬКИ валідним JSON рівно такої схеми:
{
  "days": [
    {
      "dayLabel": "Понеділок",
      "meals": {
        "breakfast": { "name": "...", "calories": 0, "protein": 0, "fat": 0, "carbs": 0, "servingSize": 0, "servings": 1, "emoji": "🥣", "description": "...", "ingredients": [{"name": "...", "quantity": 0, "unit": "г", "shoppingCategory": "grains"}], "prepTimeMinutes": 0, "cookTimeMinutes": 0, "isMultiDayPrep": false, "multiDayPrepDays": 0, "difficulty": "easy" },
        "lunch": { ...same structure... },
        "dinner": { ...same structure... },
        "snacks": [{ ...same structure... }]
      }
    }
  ]
}
shoppingCategory values: vegetables|fruits|meat|fish|dairy|grains|legumes|oils|spices|other
difficulty values: easy|medium|hard`;

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
    model: 'gpt-4o',
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

function mapDays(rawDays: Record<string, unknown>[], weekStartDate: Date): MenuDay[] {
  return rawDays.slice(0, 7).map((d, i) => {
    const rawMeals = (d.meals || {}) as Record<string, unknown>;
    const breakfast = normalizeMeal((rawMeals.breakfast || {}) as Record<string, unknown>);
    const lunch = normalizeMeal((rawMeals.lunch || {}) as Record<string, unknown>);
    const dinner = normalizeMeal((rawMeals.dinner || {}) as Record<string, unknown>);
    const snacks: AIMeal[] = Array.isArray(rawMeals.snacks)
      ? (rawMeals.snacks as Record<string, unknown>[]).map((s) => normalizeMeal(s))
      : [normalizeMeal((rawMeals.snacks || {}) as Record<string, unknown>)];

    const allMeals = [breakfast, lunch, dinner, ...snacks];
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

  const prompt = `Запропонуй ${count} альтернативні страви на заміну "${meal.name}" (${meal.calories} ккал).
Та сама категорія прийому їжі, калорійність у межах ±10% (${Math.round(meal.calories * 0.9)}–${Math.round(meal.calories * 1.1)} ккал).
Мова: українська. Реальні, різноманітні страви.
${constraints}
Відповідь — ТІЛЬКИ валідний JSON: { "alternatives": [ <AIMeal>, ... ] } з ${count} елементами.`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
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
