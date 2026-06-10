import { NextResponse } from 'next/server';
import { checkSessionSubscription } from '@/lib/subscription';
import { getDb } from '@/lib/db';
import { generateMenuWithAI, getTodayWeekdayIndex } from '@/lib/menu/generateMenuWithAI';
import { buildShoppingList } from '@/lib/menu/shoppingListBuilder';
import { UserProfile } from '@/types/userProfile';
import { WeeklyMenu } from '@/types/weeklyMenu';
import { AIMeal } from '@/types/meals';

export const maxDuration = 60; // Vercel Hobby max; prevents 10s default timeout on AI call

const MAX_GENERATIONS_PER_WEEK = 999; // temporarily unlimited for prompt testing

function getWeekStartMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function isSameWeek(a: Date | null, b: Date): boolean {
  if (!a) return false;
  const da = new Date(a);
  return da.getFullYear() === b.getFullYear() &&
    da.getMonth() === b.getMonth() &&
    da.getDate() === b.getDate();
}

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

  // Load profile
  const profile = await db.collection<UserProfile>('user_profiles').findOne({ userEmail });
  if (!profile) {
    return NextResponse.json(
      { error: 'Profile not found. Please complete onboarding first.' },
      { status: 404 },
    );
  }

  // Rate limit check
  const weekStart = getWeekStartMonday();
  const isSameW = isSameWeek(profile.lastGenerationWeekStart, weekStart);
  const generationsThisWeek = isSameW ? (profile.menuGenerationsThisWeek ?? 0) : 0;

  if (generationsThisWeek >= MAX_GENERATIONS_PER_WEEK) {
    return NextResponse.json(
      { error: 'Limit reached', message: `Максимум ${MAX_GENERATIONS_PER_WEEK} генерації на тиждень вичерпано.` },
      { status: 429 },
    );
  }

  // Get rated meals from last active menu for personalization
  const lastMenu = await db.collection<WeeklyMenu>('weekly_menus').findOne(
    { userEmail, status: 'active' },
    { sort: { createdAt: -1 } },
  );

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
    // Archive old menu. `archivedAt` drives a TTL index (see ensureIndexes.ts)
    // so archived menus are purged automatically after the retention window;
    // active menus have no archivedAt and are never auto-deleted.
    await db.collection('weekly_menus').updateOne(
      { _id: lastMenu._id as unknown as import('mongodb').ObjectId },
      { $set: { status: 'archived', archivedAt: new Date(), updatedAt: new Date() } },
    );
  }

  // Генеруємо лише сьогоднішній день — швидко (~10-20с), решту тижня
  // догенеровуємо фоновими запитами через /api/menu/generate-rest.
  const todayIdx = getTodayWeekdayIndex();
  const dayIndices = [todayIdx];
  const pendingDayIndices = Array.from({ length: 6 - todayIdx }, (_, k) => todayIdx + 1 + k);

  const { days, weekStartDate } = await generateMenuWithAI(profile, highRated, lowRated, dayIndices);

  const now = new Date();
  const newMenu = {
    userEmail,
    weekStartDate,
    goalCaloriesAtGeneration: profile.goalCalories,
    aiModel: 'gpt-4o',
    status: 'active' as const,
    days,
    pendingDayIndices,
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection('weekly_menus').insertOne(newMenu);
  const menuId = result.insertedId;

  // Build shopping list. Only the current week's list is useful, so drop any
  // prior lists for this user instead of letting them accumulate per week.
  const shoppingItems = buildShoppingList(days);
  await db.collection('shopping_lists').deleteMany({ userEmail });
  await db.collection('shopping_lists').insertOne({
    userEmail,
    weeklyMenuId: menuId,
    weekStartDate,
    items: shoppingItems,
    updatedAt: now,
  });

  // Update generation counter
  await db.collection('user_profiles').updateOne(
    { userEmail },
    {
      $set: {
        menuGenerationsThisWeek: generationsThisWeek + 1,
        lastGenerationWeekStart: weekStart,
      },
    },
  );

  return NextResponse.json({
    success: true,
    menuId: menuId.toString(),
    generationsLeft: MAX_GENERATIONS_PER_WEEK - generationsThisWeek - 1,
  });
}
