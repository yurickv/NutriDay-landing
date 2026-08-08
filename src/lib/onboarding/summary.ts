// src/lib/onboarding/summary.ts
// Похідні показники з відповідей квізу для екранів C6 (how_we_count)
// і D2 (your_profile). Сервер рахує авторитетно сам — це прев'ю для довіри.
import { calcCalories, normalizeSex } from '../calories';

export interface QuizSummary {
  bmr: number;
  tdee: number;
  goalCalories: number;
  bmi: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
}

// Орієнтовний спліт макросів 30/30/40 (білки/жири/вуглеводи), 4-9-4 ккал/г.
export function calcSummary(answers: Record<string, unknown>): QuizSummary {
  const weightKg = parseFloat(String(answers.weight ?? '0')) || 0;
  const heightCm = parseFloat(String(answers.height ?? '0')) || 0;
  const ageYears = parseInt(String(answers.age ?? '0'), 10) || 0;
  const sex = normalizeSex(typeof answers.sex === 'string' ? answers.sex : undefined);
  const activityLevel = parseFloat(String(answers.activity ?? '1.2')) || 1.2;
  const mainGoal = typeof answers.mainGoal === 'string' ? answers.mainGoal : undefined;

  const { bmr, tdee, goalCalories } = calcCalories({
    weightKg,
    heightCm,
    ageYears,
    sex,
    activityLevel,
    mainGoal,
  });

  const bmi =
    weightKg > 0 && heightCm > 0
      ? Math.round((weightKg / Math.pow(heightCm / 100, 2)) * 10) / 10
      : 0;

  return {
    bmr,
    tdee,
    goalCalories,
    bmi,
    proteinG: Math.round((goalCalories * 0.3) / 4),
    fatG: Math.round((goalCalories * 0.3) / 9),
    carbsG: Math.round((goalCalories * 0.4) / 4),
  };
}
