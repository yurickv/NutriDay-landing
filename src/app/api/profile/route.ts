import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { UserProfile } from '@/types/userProfile';
import { OnboardingData } from '@/types/onboarding';

function calcBMR(weight: number, height: number, age: number, sex: string): number {
  // Mifflin-St Jeor formula
  if (sex === 'male') {
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  }
  return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
}

function calcProfile(onboarding: OnboardingData, userEmail: string): UserProfile {
  const weightKg = parseFloat(onboarding.weight ?? '60');
  const heightCm = parseFloat(onboarding.height ?? '165');
  const ageYears = parseInt(onboarding.age ?? '25', 10);
  // Normalize: onboarding stores "Чоловік"/"Жінка" (Ukrainian), but we need "male"/"female"
  const rawSex = onboarding.sex ?? '';
  const sex = (rawSex === 'Чоловік' || rawSex === 'male') ? 'male' : 'female';
  const activityLevel = parseFloat(onboarding.activity ?? '1.375');

  const bmr = calcBMR(weightKg, heightCm, ageYears, sex);
  const tdee = Math.round(bmr * activityLevel);
  // For weight loss: ~500 kcal deficit, but never below 1200 for women / 1500 for men
  const minCalories = sex === 'male' ? 1500 : 1200;
  const goalCalories = Math.max(minCalories, tdee - 500);

  return {
    ...onboarding,
    userEmail,
    weightKg,
    heightCm,
    ageYears,
    activityLevel,
    bmr,
    tdee,
    goalCalories,
    favoriteFoods: [],
    dislikedFoods: [],
    dietaryPreferences: [],
    allergies: [],
    waterGoalMl: 2000,
    menuGenerationsThisWeek: 0,
    lastGenerationWeekStart: null,
    updatedAt: new Date(),
  };
}

export async function GET() {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const profile = await db.collection('user_profiles').findOne<UserProfile>({ userEmail });

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json(profile);
}

export async function PUT(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as Partial<UserProfile>;
  const db = await getDb();

  const update: Partial<UserProfile> = { ...body, userEmail, updatedAt: new Date() };

  // Recalculate calories if biometrics changed
  if (body.weightKg || body.heightCm || body.ageYears || body.activityLevel) {
    const existing = await db.collection<UserProfile>('user_profiles').findOne({ userEmail });
    if (existing) {
      const w = body.weightKg ?? existing.weightKg;
      const h = body.heightCm ?? existing.heightCm;
      const a = body.ageYears ?? existing.ageYears;
      const s = body.sex ?? existing.sex ?? 'female';
      const act = body.activityLevel ?? existing.activityLevel;
      const bmr = calcBMR(w, h, a, s);
      const tdee = Math.round(bmr * act);
      const minCalories = s === 'male' ? 1500 : 1200;
      update.bmr = bmr;
      update.tdee = tdee;
      update.goalCalories = Math.max(minCalories, tdee - 500);
    }
  }

  await db.collection('user_profiles').updateOne(
    { userEmail },
    { $set: update },
    { upsert: true },
  );

  return NextResponse.json({ success: true });
}

// Called on first login to initialize profile from onboarding data
export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const existing = await db.collection('user_profiles').findOne({ userEmail });
  if (existing) {
    return NextResponse.json({ success: true, alreadyExists: true });
  }

  // Load onboarding data from subscriptions or body
  const body = await req.json() as OnboardingData;
  const profile = calcProfile(body, userEmail);

  await db.collection('user_profiles').insertOne(profile);

  return NextResponse.json({ success: true });
}
