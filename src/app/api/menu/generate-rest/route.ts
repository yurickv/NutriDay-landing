import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { checkSessionSubscription } from '@/lib/subscription';
import { getDb } from '@/lib/db';
import { generateMenuWithAI } from '@/lib/menu/generateMenuWithAI';
import { buildShoppingList, mergeShoppingItems } from '@/lib/menu/shoppingListBuilder';
import { UserProfile } from '@/types/userProfile';
import { WeeklyMenu } from '@/types/weeklyMenu';
import { AIMeal } from '@/types/meals';
import { ShoppingListItem } from '@/types/shoppingList';

export const maxDuration = 60; // Vercel Hobby max; до 3 днів за раз з запасом

const CLAIM_SIZE = 3;

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
  const col = db.collection<WeeklyMenu>('weekly_menus');

  const menu = await col.findOne<WeeklyMenu & { _id: ObjectId }>(
    { userEmail, status: 'active' },
    { sort: { createdAt: -1 } },
  );

  if (!menu || !menu.pendingDayIndices?.length) {
    return NextResponse.json({ pendingDayIndices: [] });
  }

  const pending = menu.pendingDayIndices;
  const claimed = pending.slice(0, CLAIM_SIZE);
  const remaining = pending.slice(CLAIM_SIZE);

  const now = new Date();
  const claim = await col.updateOne(
    { _id: menu._id, pendingDayIndices: pending },
    { $set: { pendingDayIndices: remaining, updatedAt: now } },
  );

  if (claim.matchedCount === 0) {
    // Інший запит уже забрав цю партію — клієнт повторить пізніше.
    return NextResponse.json({ pendingDayIndices: pending });
  }

  const profile = await db.collection<UserProfile>('user_profiles').findOne({ userEmail });
  if (!profile) {
    // Повертаємо claimed назад, щоб не загубити дні.
    await col.updateOne(
      { _id: menu._id },
      { $set: { pendingDayIndices: [...claimed, ...remaining], updatedAt: new Date() } },
    );
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Передаємо як контекст лише складні страви обіду/вечері з уже згенерованих
  // днів — щоб модель могла доречно повторити їх на кілька днів поспіль
  // (готування наперед, isMultiDayPrep), а не уникала повторів.
  const priorMeals: string[] = [];
  for (const day of menu.days) {
    const mainMeals: AIMeal[] = [...day.meals.lunch, ...day.meals.dinner];
    for (const meal of mainMeals) priorMeals.push(meal.name);
  }

  try {
    const { days: newDays } = await generateMenuWithAI(profile, [], [], claimed, priorMeals);

    await col.updateOne(
      { _id: menu._id },
      { $push: { days: { $each: newDays } }, $set: { updatedAt: new Date() } },
    );

    // Оновлюємо список покупок з урахуванням нових днів, зберігаючи стан покупок.
    const shoppingCol = db.collection('shopping_lists');
    const existingList = await shoppingCol.findOne<{ _id: ObjectId; items: ShoppingListItem[] }>(
      { userEmail },
    );
    if (existingList) {
      const merged = mergeShoppingItems(existingList.items, buildShoppingList([...menu.days, ...newDays]));
      await shoppingCol.updateOne(
        { _id: existingList._id },
        { $set: { items: merged, updatedAt: new Date() } },
      );
    }

    return NextResponse.json({ pendingDayIndices: remaining });
  } catch (err) {
    // Повертаємо claimed назад у чергу, щоб клієнт спробував ще раз.
    await col.updateOne(
      { _id: menu._id },
      { $set: { pendingDayIndices: [...claimed, ...remaining], updatedAt: new Date() } },
    );
    const message = err instanceof Error ? err.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
