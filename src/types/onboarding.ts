export interface OnboardingData {
  mainGoal?: string;
  shortGoal?: string[];
  nutritionKnowledge?: string;
  // Тіло (зберігаються рядками — calcProfile робить parseFloat)
  sex?: string;
  age?: string;
  weight?: string;
  height?: string;
  activity?: string;
  // Новий квіз (docs/ONBOARDING_QUIZ_SPEC.md §2)
  targetWeight?: string;
  breakfastTime?: string;
  lunchTime?: string;
  dinnerTime?: string;
  dietaryPreferences?: string[];
  eatingHabits?: string[];
  cravings?: string[];
  foodTracking?: string;
  mealsPerDay?: string;
  batchCooking?: string;
  confidence?: string;
  // Contact
  email?: string;
  personalDataConsent?: boolean;
}
