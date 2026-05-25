import crypto from 'crypto';
import { MenuDay } from '@/types/weeklyMenu';
import { ShoppingListItem } from '@/types/shoppingList';
import { AIMeal, MealIngredient } from '@/types/meals';

interface IngredientAccumulator {
  quantity: number;
  unit: string;
  shoppingCategory: MealIngredient['shoppingCategory'];
  mealNames: Set<string>;
  forDays: Set<string>;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

export function buildShoppingList(days: MenuDay[]): ShoppingListItem[] {
  const acc = new Map<string, IngredientAccumulator>();

  for (const day of days) {
    const { breakfast, lunch, dinner, snacks } = day.meals;
    const allMeals: AIMeal[] = [breakfast, lunch, dinner, ...snacks];

    for (const meal of allMeals) {
      for (const ing of meal.ingredients) {
        const key = normalizeName(ing.name) + '_' + ing.unit;
        const existing = acc.get(key);
        const qty = ing.quantity * meal.servings;

        if (existing) {
          existing.quantity += qty;
          existing.mealNames.add(meal.name);
          existing.forDays.add(day.dayLabel);
        } else {
          acc.set(key, {
            quantity: qty,
            unit: ing.unit,
            shoppingCategory: ing.shoppingCategory,
            mealNames: new Set([meal.name]),
            forDays: new Set([day.dayLabel]),
          });
        }
      }
    }
  }

  const items: ShoppingListItem[] = [];

  for (const [key, data] of acc.entries()) {
    const name = key.split('_')[0];
    items.push({
      id: crypto.randomUUID(),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      quantity: Math.round(data.quantity * 10) / 10,
      unit: data.unit,
      shoppingCategory: data.shoppingCategory,
      mealNames: Array.from(data.mealNames),
      forDays: Array.from(data.forDays),
      isPurchased: false,
      purchasedAt: null,
      isCustom: false,
    });
  }

  // Sort by category
  const categoryOrder: MealIngredient['shoppingCategory'][] = [
    'meat', 'fish', 'dairy', 'vegetables', 'fruits', 'grains',
    'legumes', 'oils', 'spices', 'other',
  ];

  items.sort((a, b) => {
    const ai = categoryOrder.indexOf(a.shoppingCategory);
    const bi = categoryOrder.indexOf(b.shoppingCategory);
    return ai - bi || a.name.localeCompare(b.name, 'uk');
  });

  return items;
}
