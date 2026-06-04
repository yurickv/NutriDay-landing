import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { WeeklyMenu } from '@/types/weeklyMenu';
import { AIMeal } from '@/types/meals';
import { ShoppingListItem } from '@/types/shoppingList';
import { buildShoppingList, mergeShoppingItems } from '@/lib/menu/shoppingListBuilder';
import { scaleMealToCalories } from '@/lib/menu/generateMenuWithAI';

interface SwapBody {
  dayLabel: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  itemIndex?: number;
  alternativeIndex: number; // index in quickAlternatives array
}

export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as SwapBody;
  const { dayLabel, mealType, itemIndex, alternativeIndex } = body;

  const db = await getDb();
  const col = db.collection('weekly_menus');
  const menu = await col.findOne<WeeklyMenu & { _id: ObjectId }>(
    { userEmail, status: 'active' },
    { sort: { createdAt: -1 } },
  );

  if (!menu) {
    return NextResponse.json({ error: 'Menu not found' }, { status: 404 });
  }

  const dayIndex = menu.days.findIndex((d) => d.dayLabel === dayLabel);
  if (dayIndex === -1) {
    return NextResponse.json({ error: 'Day not found' }, { status: 404 });
  }

  const day = menu.days[dayIndex];
  const mealArr = mealType === 'snack' ? day.meals.snacks : day.meals[mealType];
  const originalMeal = mealArr[itemIndex ?? 0];

  if (!originalMeal) {
    return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
  }

  const alternative = originalMeal.quickAlternatives[alternativeIndex];
  if (!alternative) {
    return NextResponse.json({ error: 'Alternative not found' }, { status: 404 });
  }

  const swappedMeal: AIMeal = {
    ...alternative,
    isSwapped: true,
    originalMealSnapshot: { ...originalMeal, quickAlternatives: [] },
    isConsumed: false,
    consumedAt: null,
    consumedWeight: null,
    rating: null,
    ratedAt: null,
  };

  // Ensure the swapped meal's calories (and ingredient weights) match the original
  // so totalCalories stays accurate. This is a safety net for cases where the
  // alternative was generated before the ingredient fix or the LLM under/over-sized.
  scaleMealToCalories(swappedMeal, originalMeal.calories);

  // Update in-memory first so totalCalories can be recalculated from the new state.
  mealArr[itemIndex ?? 0] = swappedMeal;
  const allMeals = [...day.meals.breakfast, ...day.meals.lunch, ...day.meals.dinner, ...day.meals.snacks];
  const newTotalCalories = allMeals.reduce((s, m) => s + m.calories * m.servings, 0);

  const now = new Date();
  const fieldBase = `days.${dayIndex}.meals`;
  const fieldName = mealType === 'snack' ? 'snacks' : mealType;
  const updatePath = `${fieldBase}.${fieldName}.${itemIndex ?? 0}`;

  await col.updateOne(
    { _id: menu._id },
    {
      $set: {
        [updatePath]: swappedMeal,
        [`days.${dayIndex}.totalCalories`]: newTotalCalories,
        updatedAt: now,
      },
    },
  );

  // Keep the shopping list in sync with the menu: a swap changes the meal's
  // ingredients, so rebuild it (otherwise the old meal's products linger and
  // the new meal's are missing). Purchased checkmarks and manual custom items
  // are preserved across the rebuild.
  const shoppingCol = db.collection('shopping_lists');
  const existingList = await shoppingCol.findOne<{ _id: ObjectId; items: ShoppingListItem[] }>(
    { userEmail },
  );
  if (existingList) {
    const merged = mergeShoppingItems(existingList.items, buildShoppingList(menu.days));
    await shoppingCol.updateOne(
      { _id: existingList._id },
      { $set: { items: merged, updatedAt: now } },
    );
  }

  return NextResponse.json({ success: true, meal: swappedMeal });
}
