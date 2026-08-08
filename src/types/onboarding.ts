export interface OnboardingData {
  mainGoal?: string;
  goalReason?: string;
  shortGoal?: string[];
  nutritionKnowledge?: string;
  shortBarriers?: string[];
  additionalGoal?: string[];
  buildMuscleExperience?: string;
  pastExperience?: string;
  gainWeightExperience?: string;
  pastChallenges?: string[];
  roleModel?: string;
  // From CaloriesCalc
  sex?: string;
  age?: string;
  weight?: string;
  height?: string;
  activity?: string;
  // Contact
  email?: string;
  // Новий квіз (docs/ONBOARDING_QUIZ_SPEC.md §2, §6)
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
  personalDataConsent?: boolean;
}
