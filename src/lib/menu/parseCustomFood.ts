import OpenAI from 'openai';
import { NutritionPer100 } from '@/types/meals';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Result of parsing a food name. The LLM estimates only the per-100g composition;
// absolute calories/macros are computed here from the user-provided weight. `error`
// is set when the food can't be recognised — the UI then falls back to manual entry.
export interface ParsedFood {
  name: string;
  emoji: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  grams: number;
  per100: NutritionPer100 | null;
  error: string | null;
}

const SYSTEM_PROMPT = `You are a nutrition expert. The user gives the name of a dish (in Ukrainian) they ate and its eaten weight in grams. Estimate the nutrition COMPOSITION PER 100 g of that READY (cooked, ready-to-eat) dish, using typical Ukrainian / home-cooked values.

Reply with ONLY valid JSON (no markdown, no commentary) exactly matching this schema:
{
  "name": "коротка назва страви, ≤30 символів, українською",
  "emoji": "один доречний food-емодзі",
  "per100": { "calories": 0, "protein": 0, "fat": 0, "carbs": 0 }
}

RULES:
- All text values MUST be in Ukrainian.
- "per100" is the nutrition of 100 g of the ready dish (NOT the whole portion). Round all numbers to integers.
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

function errorResult(message: string): ParsedFood {
  return {
    name: '', emoji: '🍽️', calories: 0, protein: 0, fat: 0, carbs: 0,
    grams: 0, per100: null, error: message,
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

      const per100 = normalizePer100(raw.per100);
      if (!per100) {
        lastErr = new Error('Missing or empty per100');
        continue;
      }

      const f = g / 100;
      return {
        name: String(raw.name ?? text).slice(0, 30),
        emoji: String(raw.emoji ?? '🍽️'),
        calories: Math.round(per100.calories * f),
        protein: Math.round(per100.protein * f),
        fat: Math.round(per100.fat * f),
        carbs: Math.round(per100.carbs * f),
        grams: g,
        per100,
        error: null,
      };
    } catch (err) {
      lastErr = err;
    }
  }

  console.error('parseCustomFood failed:', lastErr);
  return errorResult('Не вдалося розпізнати страву. Введіть дані вручну.');
}
