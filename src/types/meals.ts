export type ShoppingCategory =
  | 'vegetables'
  | 'fruits'
  | 'meat'
  | 'fish'
  | 'dairy'
  | 'grains'
  | 'legumes'
  | 'oils'
  | 'spices'
  | 'other';

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface MealIngredient {
  name: string;
  quantity: number;
  unit: string;
  shoppingCategory: ShoppingCategory;
}

export interface AIMeal {
  name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  servingSize: number;
  servings: number;
  emoji: string;
  description: string;
  ingredients: MealIngredient[];
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  isMultiDayPrep: boolean;
  multiDayPrepDays: number;
  difficulty: Difficulty;
  isSwapped: boolean;
  originalMealSnapshot: AIMeal | null;
  quickAlternatives: AIMeal[];

  isConsumed: boolean;
  consumedAt: Date | null;
  consumedWeight: number | null;

  rating: 1 | 2 | 3 | null;
  ratedAt: Date | null;
}

export interface DayMeals {
  breakfast: AIMeal;
  lunch: AIMeal;
  dinner: AIMeal;
  snacks: AIMeal[];
}
