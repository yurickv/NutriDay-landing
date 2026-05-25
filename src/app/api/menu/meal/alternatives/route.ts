import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { checkSessionSubscription } from '@/lib/subscription';
import { getDb } from '@/lib/db';
import { WeeklyMenu } from '@/types/weeklyMenu';
import { AIMeal } from '@/types/meals';
import { UserProfile } from '@/types/userProfile';
import { generateMealAlternatives } from '@/lib/menu/generateMenuWithAI';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// GET /api/menu/meal/alternatives?dayLabel=&mealType=&snackIndex=
// Lazily generates swap alternatives for a single meal (alternatives are no longer
// bundled into the weekly menu). Generated alternatives are persisted onto the meal's
// quickAlternatives so the swap-by-index route can read them.
export async function GET(req: NextRequest) {
  const { email: userEmail, active } = await checkSessionSubscription();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!active) {
    return NextResponse.json(
      { error: 'Subscription expired', message: 'Ваша підписка завершилася.' },
      { status: 402 },
    );
  }

  const { searchParams } = new URL(req.url);
  const dayLabel = searchParams.get('dayLabel');
  const mealType = searchParams.get('mealType') as MealType | null;
  const snackIndexRaw = searchParams.get('snackIndex');
  const snackIndex = snackIndexRaw != null ? parseInt(snackIndexRaw, 10) : undefined;

  if (!dayLabel || !mealType) {
    return NextResponse.json({ error: 'Missing dayLabel or mealType' }, { status: 400 });
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

  const day = menu.days[dayIndex];
  const meal: AIMeal | undefined =
    mealType === 'snack' ? day.meals.snacks[snackIndex ?? 0] : day.meals[mealType];
  if (!meal) {
    return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
  }

  // Reuse alternatives if they were already generated for this meal.
  if (Array.isArray(meal.quickAlternatives) && meal.quickAlternatives.length > 0) {
    return NextResponse.json({ alternatives: meal.quickAlternatives });
  }

  const profile = await db.collection<UserProfile>('user_profiles').findOne({ userEmail });
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  let alternatives: AIMeal[];
  try {
    alternatives = await generateMealAlternatives(profile, meal, 3);
  } catch (err) {
    console.error('Failed to generate alternatives:', err);
    return NextResponse.json({ error: 'Failed to generate alternatives' }, { status: 502 });
  }

  const path =
    mealType === 'snack'
      ? `days.${dayIndex}.meals.snacks.${snackIndex ?? 0}.quickAlternatives`
      : `days.${dayIndex}.meals.${mealType}.quickAlternatives`;

  await col.updateOne(
    { _id: menu._id },
    { $set: { [path]: alternatives, updatedAt: new Date() } },
  );

  return NextResponse.json({ alternatives });
}
