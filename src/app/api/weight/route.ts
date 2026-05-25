import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { WeightLog } from '@/types/engagement';
import { UserProfile } from '@/types/userProfile';

function calcBMR(weight: number, height: number, age: number, sex: string): number {
  if (sex === 'male') {
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  }
  return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
}

// GET /api/weight — last 30 weight logs
export async function GET() {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const logs = await db
    .collection('weight_logs')
    .find<WeightLog & { _id: unknown }>({ userEmail })
    .sort({ date: -1 })
    .limit(30)
    .toArray();

  return NextResponse.json({ logs: logs.reverse() });
}

// POST /api/weight — add a weight entry + recalculate TDEE
export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as { weight: number; note?: string };
  if (!body.weight || body.weight < 20 || body.weight > 300) {
    return NextResponse.json({ error: 'Invalid weight' }, { status: 400 });
  }

  const db = await getDb();
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Upsert today's entry (one entry per day)
  const entry: Omit<WeightLog, '_id'> = {
    userEmail,
    date: todayMidnight,
    weight: body.weight,
    note: body.note ?? null,
    createdAt: now,
  };

  await db.collection('weight_logs').updateOne(
    { userEmail, date: todayMidnight },
    { $set: entry },
    { upsert: true },
  );

  // Recalculate TDEE with new weight
  const profile = await db
    .collection('user_profiles')
    .findOne<UserProfile>({ userEmail });

  if (profile) {
    const bmr = calcBMR(body.weight, profile.heightCm, profile.ageYears, profile.sex ?? 'female');
    const tdee = Math.round(bmr * profile.activityLevel);
    const minCalories = (profile.sex ?? 'female') === 'male' ? 1500 : 1200;
    const goalCalories = Math.max(minCalories, tdee - 500);

    await db.collection('user_profiles').updateOne(
      { userEmail },
      { $set: { weightKg: body.weight, bmr, tdee, goalCalories, updatedAt: now } },
    );
  }

  return NextResponse.json({ success: true });
}
