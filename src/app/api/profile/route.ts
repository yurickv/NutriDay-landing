import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { UserProfile } from '@/types/userProfile';
import { OnboardingData } from '@/types/onboarding';
import { calcCalories, normalizeSex } from '@/lib/calories';

function calcProfile(onboarding: OnboardingData, userEmail: string): UserProfile {
  const weightKg = parseFloat(onboarding.weight ?? '60');
  const heightCm = parseFloat(onboarding.height ?? '165');
  const ageYears = parseInt(onboarding.age ?? '25', 10);
  const sex = normalizeSex(onboarding.sex);
  const activityLevel = parseFloat(onboarding.activity ?? '1.375');

  const { bmr, tdee, goalCalories } = calcCalories({
    weightKg,
    heightCm,
    ageYears,
    sex,
    activityLevel,
    mainGoal: onboarding.mainGoal,
  });

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

  // Recalculate calories if biometrics or goal changed
  if (
    body.weightKg || body.heightCm || body.ageYears ||
    body.activityLevel || body.sex || body.mainGoal
  ) {
    const existing = await db.collection<UserProfile>('user_profiles').findOne({ userEmail });
    if (existing) {
      const { bmr, tdee, goalCalories } = calcCalories({
        weightKg: body.weightKg ?? existing.weightKg,
        heightCm: body.heightCm ?? existing.heightCm,
        ageYears: body.ageYears ?? existing.ageYears,
        sex: normalizeSex(body.sex ?? existing.sex),
        activityLevel: body.activityLevel ?? existing.activityLevel,
        mainGoal: body.mainGoal ?? existing.mainGoal,
      });
      update.bmr = bmr;
      update.tdee = tdee;
      update.goalCalories = goalCalories;
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
