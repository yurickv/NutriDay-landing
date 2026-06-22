import OpenAI from 'openai';
import { MealIngredient, NutritionPer100 } from '@/types/meals';
import { computeNutritionDetailed, per100FromTotals } from './foodNutrition';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Result of parsing a food name. When the LLM's ingredient decomposition is well
// covered by the nutrition table, calories/macros are computed deterministically
// (method 'ingredients'); otherwise we fall back to the LLM's per-100g estimate
// (method 'estimate'). `error` is set when the food can't be recognised at all.
export interface ParsedFood {
  name: string;
  emoji: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  grams: number;
  per100: NutritionPer100 | null;
  ingredients: MealIngredient[];
  method: 'ingredients' | 'estimate';
  error: string | null;
}

// Below this table-coverage ratio (matched grams / total grams) the deterministic
// computation is considered unreliable and we use the LLM per-100g estimate.
const COVERAGE_THRESHOLD = 0.6;

const SYSTEM_PROMPT = `You are a nutrition expert. The user gives the name of a dish (in Ukrainian) they ate and its eaten weight in grams.

Do TWO things:
1. Decompose the dish into its main ingredients with realistic weights that together roughly equal the eaten weight. Use raw / as-purchased weights. Unit "г" for solids, "мл" for liquids, "шт" only for naturally countable items (e.g. eggs).
2. Also provide your own fallback estimate of the nutrition PER 100 g of the READY (cooked) dish.

Reply with ONLY valid JSON (no markdown, no commentary) exactly matching this schema:
{
  "name": "коротка назва страви, ≤30 символів, українською",
  "emoji": "один доречний food-емодзі",
  "ingredients": [{ "name": "...", "quantity": 0, "unit": "г", "shoppingCategory": "other" }],
  "per100": { "calories": 0, "protein": 0, "fat": 0, "carbs": 0 }
}
shoppingCategory values: vegetables|fruits|meat|fish|dairy|grains|legumes|oils|spices|other

RULES:
- All text values MUST be in Ukrainian.
- Ingredient names MUST be simple product names (e.g. "куряче філе", "гречана крупа", "олія соняшникова", "морква") so they can be matched against a nutrition table.
- "per100" is the nutrition of 100 g of the READY dish. Round all numbers to integers.
- Return { "error": "коротке пояснення українською" } ONLY if the text is not food at all or is impossible to understand (gibberish).`;

function num(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function normalizePer100(raw: unknown): NutritionPer100 | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const per100 = {
    calories: num(r.calories),
    protein: num(r.protein),
    fat: num(r.fat),
    carbs: num(r.carbs),
  };
  // Reject an all-zero result as unusable.
  if (per100.calories === 0 && per100.protein === 0 && per100.fat === 0 && per100.carbs === 0) {
    return null;
  }
  return per100;
}

function normalizeIngredients(raw: unknown): MealIngredient[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 40)
    .map((r) => {
      const i = (r ?? {}) as Record<string, unknown>;
      return {
        name: String(i.name ?? '').slice(0, 60),
        quantity: Math.max(0, Math.round(Number(i.quantity) || 0)),
        unit: String(i.unit ?? 'г').slice(0, 8),
        shoppingCategory:
          (i.shoppingCategory as MealIngredient['shoppingCategory']) ?? 'other',
      };
    })
    .filter((i) => i.name.length > 0 && i.quantity > 0);
}

function errorResult(message: string): ParsedFood {
  return {
    name: '', emoji: '🍽️', calories: 0, protein: 0, fat: 0, carbs: 0,
    grams: 0, per100: null, ingredients: [], method: 'estimate', error: message,
  };
}

async function callOpenAI(userContent: string): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    max_tokens: 300,
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });
  return response.choices[0]?.message.content ?? '';
}

/**
 * Estimate nutrition for a named dish at the given eaten weight (grams).
 * The LLM returns only per-100g composition; absolute calories/macros are scaled
 * here from `grams`. Returns a ParsedFood with `error` set when unrecognised.
 */
export async function parseCustomFood(text: string, grams: number): Promise<ParsedFood> {
  const g = Math.max(1, Math.round(grams) || 0);
  const userContent = `Страва: ${text}\nВага з'їденої порції: ${g} г`;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const content = await callOpenAI(userContent);
      const raw = JSON.parse(content) as Record<string, unknown>;

      if (typeof raw.error === 'string' && raw.error.trim()) {
        return errorResult(raw.error.trim());
      }

      const name = String(raw.name ?? text).slice(0, 30);
      const emoji = String(raw.emoji ?? '🍽️');
      const ingredients = normalizeIngredients(raw.ingredients);
      const llmPer100 = normalizePer100(raw.per100);

      // Preferred path: deterministic table computation when coverage is high.
      if (ingredients.length > 0) {
        const d = computeNutritionDetailed(ingredients);
        const coverage = d.totalGrams > 0 ? d.matchedGrams / d.totalGrams : 0;
        if (coverage >= COVERAGE_THRESHOLD && d.calories > 0) {
          return {
            name,
            emoji,
            calories: d.calories,
            protein: d.protein,
            fat: d.fat,
            carbs: d.carbs,
            grams: d.totalGrams,
            per100: per100FromTotals(d, d.totalGrams),
            ingredients,
            method: 'ingredients',
            error: null,
          };
        }
      }

      // Fallback: scale the LLM's per-100g estimate to the eaten weight.
      if (!llmPer100) {
        lastErr = new Error('No usable nutrition (low coverage and no per100)');
        continue;
      }
      const f = g / 100;
      return {
        name,
        emoji,
        calories: Math.round(llmPer100.calories * f),
        protein: Math.round(llmPer100.protein * f),
        fat: Math.round(llmPer100.fat * f),
        carbs: Math.round(llmPer100.carbs * f),
        grams: g,
        per100: llmPer100,
        ingredients,
        method: 'estimate',
        error: null,
      };
    } catch (err) {
      lastErr = err;
    }
  }

  console.error('parseCustomFood failed:', lastErr);
  return errorResult('Не вдалося розпізнати страву. Введіть дані вручну.');
}
