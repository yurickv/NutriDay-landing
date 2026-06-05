import { NextResponse } from 'next/server';
import { checkSessionSubscription } from '@/lib/subscription';
import { getDb } from '@/lib/db';
import { inngest } from '@/inngest/client';
import { UserProfile } from '@/types/userProfile';
import { WeeklyMenu } from '@/types/weeklyMenu';
import { AIMeal } from '@/types/meals';
import { getWeekStartMonday, isSameWeek } from '@/lib/menu/weekUtils';

const MAX_GENERATIONS_PER_WEEK = 999; // temporarily unlimited for prompt testing

export async function POST() {
  const { email: userEmail, active } = await checkSessionSubscription();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!active) {
    return NextResponse.json(
      { error: 'Subscription expired', message: 'Ваша підписка завершилася. Поновіть її, щоб згенерувати меню.' },
      { status: 402 },
    );
  }

  const db = await getDb();
  const profile = await db.collection<UserProfile>('user_profiles').findOne({ userEmail });
  if (!profile) {
    return NextResponse.json(
      { error: 'Profile not found. Please complete onboarding first.' },
      { status: 404 },
    );
  }

  // Prevent duplicate concurrent generation.
  if (profile.generationStatus === 'pending') {
    return NextResponse.json({ status: 'pending', message: 'Генерація вже виконується' });
  }

  // Rate limit check
  const weekStart = getWeekStartMonday();
  const generationsThisWeek = isSameWeek(profile.lastGenerationWeekStart, weekStart)
    ? (profile.menuGenerationsThisWeek ?? 0)
    : 0;

  if (generationsThisWeek >= MAX_GENERATIONS_PER_WEEK) {
    return NextResponse.json(
      { error: 'Limit reached', message: `Максимум ${MAX_GENERATIONS_PER_WEEK} генерацій на тиждень вичерпано.` },
      { status: 429 },
    );
  }

  // Collect ratings from the current active menu for personalisation.
  const lastMenu = await db
    .collection<WeeklyMenu>('weekly_menus')
    .findOne({ userEmail, status: 'active' }, { sort: { createdAt: -1 } });

  const highRated: string[] = [];
  const lowRated: string[] = [];
  if (lastMenu) {
    for (const day of lastMenu.days) {
      const allMeals: AIMeal[] = [
        ...day.meals.breakfast,
        ...day.meals.lunch,
        ...day.meals.dinner,
        ...day.meals.snacks,
      ];
      for (const meal of allMeals) {
        if (meal.rating === 3) highRated.push(meal.name);
        if (meal.rating === 1) lowRated.push(meal.name);
      }
    }
  }

  // Mark generation as pending (prevents double-submit) and enqueue the job.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.collection('user_profiles') as any).updateOne(
    { userEmail },
    { $set: { generationStatus: 'pending', generationError: null } },
  );

  await inngest.send({
    name: 'menu/generate.requested',
    data: { userEmail, highRated, lowRated },
  });

  return NextResponse.json({ status: 'pending' });
}
