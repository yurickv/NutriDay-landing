import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { WeeklyMenu } from '@/types/weeklyMenu';

interface RateBody {
  dayLabel: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  snackIndex?: number;
  rating: 1 | 2 | 3;
}

export async function PATCH(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as RateBody;
  const { dayLabel, mealType, snackIndex, rating } = body;

  if (![1, 2, 3].includes(rating)) {
    return NextResponse.json({ error: 'Invalid rating' }, { status: 400 });
  }

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
        [`${updatePath}.rating`]: rating,
        [`${updatePath}.ratedAt`]: now,
        updatedAt: now,
      },
    },
  );

  return NextResponse.json({ success: true });
}
