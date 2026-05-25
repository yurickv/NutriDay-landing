import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { readSessionUserId } from '@/lib/auth/session';

export async function POST(req: Request) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const subscription = await req.json();
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
  }

  const db = await getDb();
  const col = db.collection('push_subscriptions');

  await (col as any).updateOne(
    { userEmail, endpoint: subscription.endpoint },
    {
      $set: {
        userEmail,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        isActive: true,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        mealReminderTimes: { breakfast: '08:00', lunch: '13:00', dinner: '19:00' },
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}
