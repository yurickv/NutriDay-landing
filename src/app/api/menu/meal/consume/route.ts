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
}

export async function PATCH(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as ConsumeBody;
  const { dayLabel, mealType, snackIndex, isConsumed } = body;

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

  await col.updateOne(
    { _id: menu._id },
    {
      $set: {
        [`${updatePath}.isConsumed`]: isConsumed,
        [`${updatePath}.consumedAt`]: isConsumed ? now : null,
        updatedAt: now,
      },
    },
  );

  // Check if day should be auto-completed (≥3 of 4 meals consumed)
  const updatedMenu = await col.findOne<WeeklyMenu & { _id: ObjectId }>({ _id: menu._id });

  if (updatedMenu) {
    const day = updatedMenu.days[dayIndex];
    const allMeals = [day.meals.breakfast, day.meals.lunch, day.meals.dinner, ...day.meals.snacks];
    const consumed = allMeals.filter((m) => m.isConsumed).length;

    if (!day.isCompleted && consumed >= 3) {
      await col.updateOne(
        { _id: menu._id },
        {
          $set: {
            [`days.${dayIndex}.isCompleted`]: true,
            [`days.${dayIndex}.completedAt`]: now,
            updatedAt: now,
          },
        },
      );
      await updateStreak(userEmail);
    }
  }

  return NextResponse.json({ success: true });
}
