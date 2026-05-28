import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { WeeklyMenu } from '@/types/weeklyMenu';
import { AIMeal } from '@/types/meals';

interface SwapBody {
  dayLabel: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  snackIndex?: number;
  alternativeIndex: number; // index in quickAlternatives array
}

export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as SwapBody;
  const { dayLabel, mealType, snackIndex, alternativeIndex } = body;

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
  let originalMeal: AIMeal;

  if (mealType === 'snack') {
    originalMeal = day.meals.snacks[snackIndex ?? 0];
  } else {
    originalMeal = day.meals[mealType];
  }

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

  const now = new Date();
  const fieldBase = `days.${dayIndex}.meals`;
  const updatePath =
    mealType === 'snack'
      ? `${fieldBase}.snacks.${snackIndex ?? 0}`
      : `${fieldBase}.${mealType}`;

  await col.updateOne(
    { _id: menu._id },
    {
      $set: {
        [updatePath]: swappedMeal,
        updatedAt: now,
      },
    },
  );

  return NextResponse.json({ success: true, meal: swappedMeal });
}
