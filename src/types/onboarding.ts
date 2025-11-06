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
}
