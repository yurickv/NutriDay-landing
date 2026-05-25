import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';

interface FoodPreferencesBody {
  favoriteFoods?: string[];
  dislikedFoods?: string[];
  dietaryPreferences?: string[];
  allergies?: string[];
  waterGoalMl?: number;
}

export async function PUT(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as FoodPreferencesBody;
  const { favoriteFoods, dislikedFoods, dietaryPreferences, allergies, waterGoalMl } = body;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (Array.isArray(favoriteFoods)) update.favoriteFoods = favoriteFoods;
  if (Array.isArray(dislikedFoods)) update.dislikedFoods = dislikedFoods;
  if (Array.isArray(dietaryPreferences)) update.dietaryPreferences = dietaryPreferences;
  if (Array.isArray(allergies)) update.allergies = allergies;
  if (typeof waterGoalMl === 'number' && waterGoalMl >= 500 && waterGoalMl <= 5000) {
    update.waterGoalMl = waterGoalMl;
  }

  const db = await getDb();
  const result = await db.collection('user_profiles').updateOne(
    { userEmail },
    { $set: update },
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
