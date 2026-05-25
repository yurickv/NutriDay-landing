import { NextResponse } from 'next/server';
import { checkSessionSubscription } from '@/lib/subscription';
import { getDb } from '@/lib/db';
import { WeeklyMenu } from '@/types/weeklyMenu';

export async function GET() {
  const { email: userEmail, active } = await checkSessionSubscription();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!active) {
    return NextResponse.json(
      { error: 'Subscription expired', message: 'Ваша підписка завершилася. Поновіть її, щоб переглядати меню.' },
      { status: 402 },
    );
  }

  const db = await getDb();
  const menu = await db.collection<WeeklyMenu>('weekly_menus').findOne(
    { userEmail, status: 'active' },
    { sort: { createdAt: -1 } },
  );

  if (!menu) {
    return NextResponse.json({ menu: null });
  }

  return NextResponse.json({ menu });
}
