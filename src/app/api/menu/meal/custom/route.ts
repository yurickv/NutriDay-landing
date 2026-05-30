import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { WeeklyMenu } from '@/types/weeklyMenu';
import { CustomEntry } from '@/types/meals';
import { updateStreak } from '@/lib/menu/streakUpdater';

interface PostBody {
  dayLabel: string;
  entry: Partial<CustomEntry>;
}

interface DeleteBody {
  dayLabel: string;
  entryId: string;
}

function num(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

// Mirrors the auto-completion logic in /api/menu/meal/consume, but custom entries
// also count as eaten "meals" toward the ≥3 threshold.
async function maybeCompleteDay(
  col: ReturnType<Awaited<ReturnType<typeof getDb>>['collection']>,
  menuId: ObjectId,
  dayIndex: number,
  userEmail: string,
) {
  const updated = await col.findOne<WeeklyMenu & { _id: ObjectId }>({ _id: menuId });
  if (!updated) return;

  const day = updated.days[dayIndex];
  const menuMeals = [day.meals.breakfast, day.meals.lunch, day.meals.dinner, ...day.meals.snacks];
  const consumedCount =
    menuMeals.filter((m) => m.isConsumed).length + (day.customEntries?.length ?? 0);

  if (!day.isCompleted && consumedCount >= 3) {
    const now = new Date();
    await col.updateOne(
      { _id: menuId },
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

export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as PostBody;
  const { dayLabel, entry } = body;

  if (!dayLabel || !entry || !String(entry.name ?? '').trim()) {
    return NextResponse.json({ error: 'Некоректні дані' }, { status: 400 });
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

  const gramsRaw = num(entry.grams);
  const newEntry: CustomEntry = {
    id: crypto.randomUUID(),
    name: String(entry.name).trim().slice(0, 30),
    emoji: String(entry.emoji ?? '🍽️').slice(0, 8) || '🍽️',
    calories: num(entry.calories),
    protein: num(entry.protein),
    fat: num(entry.fat),
    carbs: num(entry.carbs),
    grams: gramsRaw > 0 ? gramsRaw : null,
    per100:
      entry.per100 && typeof entry.per100 === 'object'
        ? {
            calories: num(entry.per100.calories),
            protein: num(entry.per100.protein),
            fat: num(entry.per100.fat),
            carbs: num(entry.per100.carbs),
          }
        : null,
    source: entry.source === 'manual' ? 'manual' : 'ai',
    createdAt: new Date(),
  };

  await col.updateOne(
    { _id: menu._id },
    {
      $push: { [`days.${dayIndex}.customEntries`]: newEntry },
      $set: { updatedAt: new Date() },
    } as Record<string, unknown>,
  );

  await maybeCompleteDay(col, menu._id, dayIndex, userEmail);

  return NextResponse.json({ success: true, entry: newEntry });
}

export async function DELETE(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as DeleteBody;
  const { dayLabel, entryId } = body;

  if (!dayLabel || !entryId) {
    return NextResponse.json({ error: 'Некоректні дані' }, { status: 400 });
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

  await col.updateOne(
    { _id: menu._id },
    {
      $pull: { [`days.${dayIndex}.customEntries`]: { id: entryId } },
      $set: { updatedAt: new Date() },
    } as Record<string, unknown>,
  );

  return NextResponse.json({ success: true });
}
