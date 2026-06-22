import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { computeNutritionDetailed, per100FromTotals } from '@/lib/menu/foodNutrition';
import { MealIngredient } from '@/types/meals';

interface ComputeBody {
  ingredients: MealIngredient[];
}

// Deterministic nutrition computation from an ingredient list. No OpenAI call,
// so it only needs a valid session (not an active subscription) — the UI calls
// it on every ingredient edit without incurring AI cost.
export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as ComputeBody;
  const list = Array.isArray(body.ingredients) ? body.ingredients : [];
  if (list.length === 0 || list.length > 40) {
    return NextResponse.json({ error: 'Некоректний список інгредієнтів' }, { status: 400 });
  }

  const ingredients = list.slice(0, 40).map((i) => ({
    name: String(i.name ?? '').slice(0, 60),
    quantity: Math.max(0, Math.min(5000, Math.round(Number(i.quantity) || 0))),
    unit: String(i.unit ?? 'г').slice(0, 8),
  }));

  const d = computeNutritionDetailed(ingredients);
  const per100 = per100FromTotals(d, d.totalGrams);

  return NextResponse.json({
    calories: d.calories,
    protein: d.protein,
    fat: d.fat,
    carbs: d.carbs,
    grams: d.totalGrams,
    per100,
  });
}
