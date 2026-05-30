import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { WaterLog } from '@/types/engagement';
import { UserProfile } from '@/types/userProfile';

function todayMidnightUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

// Resolve a YYYY-MM-DD param to a UTC-midnight Date; fall back to today.
function midnightUTCFromISO(s?: string | null): Date {
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  }
  return todayMidnightUTC();
}

// GET /api/water?date=YYYY-MM-DD — water log for a specific day (default today)
export async function GET(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const date = midnightUTCFromISO(req.nextUrl.searchParams.get('date'));

  const log = await db.collection('water_logs').findOne<WaterLog>({ userEmail, date });

  if (!log) {
    const profile = await db.collection('user_profiles').findOne<UserProfile>({ userEmail });
    return NextResponse.json({
      userEmail,
      date,
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

  const body = await req.json() as { amountMl: number; date?: string };
  if (!body.amountMl || body.amountMl <= 0 || body.amountMl > 2000) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  const db = await getDb();
  const date = midnightUTCFromISO(body.date);
  const now = new Date();

  const profile = await db.collection('user_profiles').findOne<UserProfile>({ userEmail });
  const goalMl = profile?.waterGoalMl ?? 2000;

  const existing = await db.collection('water_logs').findOne<WaterLog>({ userEmail, date });

  if (!existing) {
    await (db.collection('water_logs') as any).insertOne({ // eslint-disable-line @typescript-eslint/no-explicit-any
      userEmail,
      date,
      amountMl: body.amountMl,
      goalMl,
      logs: [{ amountMl: body.amountMl, loggedAt: now }],
    });
    return NextResponse.json({ amountMl: body.amountMl, goalMl });
  }

  const newTotal = existing.amountMl + body.amountMl;

  await (db.collection('water_logs') as any).updateOne( // eslint-disable-line @typescript-eslint/no-explicit-any
    { userEmail, date },
    {
      $set: { amountMl: newTotal, goalMl },
      $push: { logs: { amountMl: body.amountMl, loggedAt: now } },
    },
  );

  return NextResponse.json({ amountMl: newTotal, goalMl });
}
