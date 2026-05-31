// Single source of truth for BMR / TDEE / daily calorie target (goalCalories).
// Mifflin-St Jeor BMR × activity = TDEE, then a goal-based correction factor.
// Previously this logic was duplicated (with a flat -500 deficit that ignored the
// user's goal) in api/profile/route.ts, the magic-link consume route, and
// CaloriesCalcList.tsx.

export type Sex = 'male' | 'female';

// Onboarding stores sex as the Ukrainian label "Чоловік"/"Жінка"; everything
// downstream needs the canonical 'male'/'female'.
export function normalizeSex(raw?: string): Sex {
  return raw === 'Чоловік' || raw === 'male' ? 'male' : 'female';
}

// Mifflin-St Jeor Basal Metabolic Rate.
export function calcBmr(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: Sex,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

// Goal correction applied to TDEE. Keys match the values stored by
// onboarding/main-goal (mainGoal). Unknown/empty goal → no change (×1.0).
export const GOAL_FACTORS: Record<string, number> = {
  lose_weight: 0.85,
  gain_weight: 1.15,
  build_muscle: 1.15,
  maintain_weight: 1.0,
  something_else: 1.0,
};

export function goalFactor(mainGoal?: string): number {
  return GOAL_FACTORS[mainGoal ?? ''] ?? 1.0;
}

export interface CalorieInput {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  sex: Sex;
  activityLevel: number;
  mainGoal?: string;
}

export interface CalorieResult {
  bmr: number;
  tdee: number;
  goalCalories: number;
}

// Never recommend below these floors even on an aggressive deficit.
const MIN_CALORIES: Record<Sex, number> = { male: 1500, female: 1200 };

export function calcCalories(input: CalorieInput): CalorieResult {
  const bmr = calcBmr(input.weightKg, input.heightCm, input.ageYears, input.sex);
  const tdee = Math.round(bmr * input.activityLevel);
  const adjusted = Math.round(tdee * goalFactor(input.mainGoal));
  const goalCalories = Math.max(MIN_CALORIES[input.sex], adjusted);
  return { bmr, tdee, goalCalories };
}
