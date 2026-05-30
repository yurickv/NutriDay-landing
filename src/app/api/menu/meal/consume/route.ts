import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { WeeklyMenu } from '@/types/weeklyMenu';
import { updateStreak } from '@/lib/menu/streakUpdater';

interface ConsumeBody {
  menuId: string;
  dayLabel: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  snackIndex?: number;
  isConsumed: boolean;
  consumedWeight?: number | null;
}

export async function PATCH(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as ConsumeBody;
  const { dayLabel, mealType, snackIndex, isConsumed, consumedWeight } = body;

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

  const now = new Date();
  const fieldBase = `days.${dayIndex}.meals`;
  const updatePath =
    mealType === 'snack'
      ? `${fieldBase}.snacks.${snackIndex ?? 0}`
      : `${fieldBase}.${mealType}`;

  // Compute the day's post-update completion locally from the already-loaded
  // menu instead of re-reading the document (removes an N+1 round trip). We
  // know exactly which meal is toggling, so we can derive the resulting count.
  const day = menu.days[dayIndex];
  const target =
    mealType === 'snack' ? day.meals.snacks[snackIndex ?? 0] : day.meals[mealType];
  const menuMeals = [day.meals.breakfast, day.meals.lunch, day.meals.dinner, ...day.meals.snacks];
  const consumedBefore = menuMeals.filter((m) => m.isConsumed).length;
  const delta = (isConsumed ? 1 : 0) - (target?.isConsumed ? 1 : 0);
  // Custom entries also count as eaten toward the ≥3 threshold (mirrors
  // /api/menu/meal/custom so completion is consistent across both routes).
  const consumedAfter = consumedBefore + delta + (day.customEntries?.length ?? 0);
  const shouldComplete = !day.isCompleted && consumedAfter >= 3;

  const set: Record<string, unknown> = {
    [`${updatePath}.isConsumed`]: isConsumed,
    [`${updatePath}.consumedAt`]: isConsumed ? now : null,
    [`${updatePath}.consumedWeight`]:
      isConsumed && typeof consumedWeight === 'number' && consumedWeight > 0
        ? Math.round(consumedWeight)
        : null,
    updatedAt: now,
  };
  if (shouldComplete) {
    set[`days.${dayIndex}.isCompleted`] = true;
    set[`days.${dayIndex}.completedAt`] = now;
  }

  await col.updateOne({ _id: menu._id }, { $set: set });

  if (shouldComplete) {
    await updateStreak(userEmail);
  }

  return NextResponse.json({ success: true });
}
