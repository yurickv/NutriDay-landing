import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { readSessionUserId } from '@/lib/auth/session';

export async function POST(req: Request) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { endpoint } = await req.json();
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });

  const db = await getDb();
  await db.collection('push_subscriptions').updateOne(
    { userEmail, endpoint },
    { $set: { isActive: false, updatedAt: new Date() } }
  );

  return NextResponse.json({ ok: true });
}
