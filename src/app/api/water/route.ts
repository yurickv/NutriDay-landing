import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { UserProfile } from '@/types/userProfile';

// Append-only model: each logged portion is its own tiny document
// { userEmail, date, amountMl, loggedAt }. The daily total is derived by
// summing portions, so documents never grow unbounded (previously every
// portion was $push-ed into a single document's `logs[]` array). The
// { userEmail, date } index supports both the lookup and the aggregation.

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

async function sumForDay(
  db: Awaited<ReturnType<typeof getDb>>,
  userEmail: string,
  date: Date,
): Promise<number> {
  const rows = await db
    .collection('water_logs')
    .aggregate<{ total: number }>([
      { $match: { userEmail, date } },
      { $group: { _id: null, total: { $sum: '$amountMl' } } },
    ])
    .toArray();
  return rows[0]?.total ?? 0;
}

// GET /api/water?date=YYYY-MM-DD — water total for a specific day (default today)
export async function GET(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const date = midnightUTCFromISO(req.nextUrl.searchParams.get('date'));

  const profile = await db.collection('user_profiles').findOne<UserProfile>({ userEmail });
  const goalMl = profile?.waterGoalMl ?? 2000;
  const amountMl = await sumForDay(db, userEmail, date);

  return NextResponse.json({ userEmail, date, amountMl, goalMl, logs: [] });
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

  await (db.collection('water_logs') as any).insertOne({ // eslint-disable-line @typescript-eslint/no-explicit-any
    userEmail,
    date,
    amountMl: body.amountMl,
    loggedAt: now,
  });

  // Aggregate the authoritative total (avoids the read-modify-write race of
  // incrementing a stored running total).
  const amountMl = await sumForDay(db, userEmail, date);

  return NextResponse.json({ amountMl, goalMl });
}
