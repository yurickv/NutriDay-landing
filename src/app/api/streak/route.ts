import { NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { UserStreak } from '@/types/engagement';

// GET /api/streak — return current streak data
export async function GET() {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const streak = await db
    .collection('user_streaks')
    .findOne<UserStreak>({ userEmail });

  if (!streak) {
    const empty: UserStreak = {
      userEmail,
      currentStreak: 0,
      longestStreak: 0,
      lastCheckedDate: new Date(0),
      totalDaysCompleted: 0,
      badges: [],
    };
    return NextResponse.json(empty);
  }

  return NextResponse.json(streak);
}
