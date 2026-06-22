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
  breakfast: AIMeal[];
  lunch: AIMeal[];
  dinner: AIMeal[];
  snacks: AIMeal[];
}

// Per-100g nutrition reference, used to re-scale a custom entry when the user
// adjusts its eaten weight in the form.
export interface NutritionPer100 {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

// A food the user ate outside the AI menu (home dish, product, snack out).
// calories/protein/fat/carbs are ABSOLUTE for the amount actually eaten — the
// daily total simply sums them, no consumedFactor scaling.
export interface CustomEntry {
  id: string;
  name: string;
  emoji: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  grams: number | null; // eaten weight in grams (null for count-based, e.g. "2 eggs")
  per100: NutritionPer100 | null; // reference values for weight re-scaling
  ingredients?: MealIngredient[]; // decomposition when method='ingredients' (optional)
  source: 'ai' | 'manual';
  createdAt: Date;
}
