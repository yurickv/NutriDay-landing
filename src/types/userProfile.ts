import { OnboardingData } from './onboarding';

export interface UserProfile extends OnboardingData {
  userEmail: string;

  // Biometrics (numbers, parsed from onboarding strings)
  weightKg: number;
  heightCm: number;
  ageYears: number;
  activityLevel: number; // e.g. 1.2 | 1.375 | 1.55 | 1.725 | 1.9

  // Calculated
  bmr: number;
  tdee: number;
  goalCalories: number; // min 1200

  // Food preferences (managed by user)
  favoriteFoods: string[];
  dislikedFoods: string[];
  dietaryPreferences: string[];
  allergies: string[];
  waterGoalMl: number;

  // Generation limits
  menuGenerationsThisWeek: number;
  lastGenerationWeekStart: Date | null;

  // Async generation status (set by Inngest worker)
  generationStatus?: 'pending' | 'done' | 'error';
  generationError?: string | null;

  updatedAt: Date;
}
