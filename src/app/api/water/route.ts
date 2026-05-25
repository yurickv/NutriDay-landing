import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { WaterLog } from '@/types/engagement';
import { UserProfile } from '@/types/userProfile';

function todayMidnightUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// GET /api/water — today's water log
export async function GET() {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const today = todayMidnightUTC();

  const log = await db.collection('water_logs').findOne<WaterLog>({ userEmail, date: today });

  if (!log) {
    const profile = await db.collection('user_profiles').findOne<UserProfile>({ userEmail });
    return NextResponse.json({
      userEmail,
      date: today,
      amountMl: 0,
      goalMl: profile?.waterGoalMl ?? 2000,
      logs: [],
    });
  }

  return NextResponse.json(log);
}

// POST /api/water — log a water portion
export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { amountMl: number };
  if (!body.amountMl || body.amountMl <= 0 || body.amountMl > 2000) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  const db = await getDb();
  const today = todayMidnightUTC();
  const now = new Date();

  const profile = await db.collection('user_profiles').findOne<UserProfile>({ userEmail });
  const goalMl = profile?.waterGoalMl ?? 2000;

  const existing = await db.collection('water_logs').findOne<WaterLog>({ userEmail, date: today });

  if (!existing) {
    await (db.collection('water_logs') as any).insertOne({ // eslint-disable-line @typescript-eslint/no-explicit-any
      userEmail,
      date: today,
      amountMl: body.amountMl,
      goalMl,
      logs: [{ amountMl: body.amountMl, loggedAt: now }],
    });
    return NextResponse.json({ amountMl: body.amountMl, goalMl });
  }

  const newTotal = existing.amountMl + body.amountMl;

  await (db.collection('water_logs') as any).updateOne( // eslint-disable-line @typescript-eslint/no-explicit-any
    { userEmail, date: today },
    {
      $set: { amountMl: newTotal, goalMl },
      $push: { logs: { amountMl: body.amountMl, loggedAt: now } },
    },
  );

  return NextResponse.json({ amountMl: newTotal, goalMl });
}
