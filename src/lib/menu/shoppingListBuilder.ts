import crypto from 'crypto';
import { MenuDay } from '@/types/weeklyMenu';
import { ShoppingListItem } from '@/types/shoppingList';
import { AIMeal, MealIngredient } from '@/types/meals';

interface IngredientAccumulator {
  byDay: number[]; // index 0 = first menu day (Понеділок) … 6 = Неділя
  unit: string;
  shoppingCategory: MealIngredient['shoppingCategory'];
  mealNames: Set<string>;
  forDays: Set<string>;
}

const DAYS_IN_WEEK = 7;

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

// Stable key used both to aggregate ingredients and to match an item against a
// previous list when carrying over purchase state on rebuild.
export function shoppingItemKey(name: string, unit: string): string {
  return normalizeName(name) + '_' + unit;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildShoppingList(days: MenuDay[]): ShoppingListItem[] {
  const acc = new Map<string, IngredientAccumulator>();

  days.forEach((day, dayIndex) => {
    // The menu is always Понеділок→Неділя ordered; guard anyway so a stray
    // 8th day never writes past the week array.
    if (dayIndex >= DAYS_IN_WEEK) return;
    const { breakfast, lunch, dinner, snacks } = day.meals;
    const allMeals: AIMeal[] = [...breakfast, ...lunch, ...dinner, ...snacks];

    for (const meal of allMeals) {
      for (const ing of meal.ingredients) {
        const key = shoppingItemKey(ing.name, ing.unit);
        const qty = ing.quantity * meal.servings;

        let existing = acc.get(key);
        if (!existing) {
          existing = {
            byDay: new Array(DAYS_IN_WEEK).fill(0),
            unit: ing.unit,
            shoppingCategory: ing.shoppingCategory,
            mealNames: new Set(),
            forDays: new Set(),
          };
          acc.set(key, existing);
        }

        existing.byDay[dayIndex] += qty;
        existing.mealNames.add(meal.name);
        existing.forDays.add(day.dayLabel);
      }
    }
  });

  const items: ShoppingListItem[] = [];

  for (const [key, data] of acc.entries()) {
    const name = key.split('_')[0];
    const quantityByDay = data.byDay.map(round1);
    items.push({
      id: crypto.randomUUID(),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      // Sum the already-rounded per-day values (not the raw total) so the week
      // total equals Пн–Ср + Чт–Нд exactly, with no rounding drift.
      quantity: round1(quantityByDay.reduce((s, q) => s + q, 0)),
      quantityByDay,
      unit: data.unit,
      shoppingCategory: data.shoppingCategory,
      mealNames: Array.from(data.mealNames),
      forDays: Array.from(data.forDays),
      isPurchased: false,
      purchasedPeriods: [],
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

/**
 * Rebuild the menu-derived part of the list while keeping the user's state:
 * - purchased checkmarks carry over to the matching freshly-built item;
 * - manually added custom items are preserved as-is.
 * Used when the menu changes after the initial build (e.g. a meal swap), so the
 * list stays in sync with the menu instead of showing ghost/missing products.
 */
export function mergeShoppingItems(
  previous: ShoppingListItem[],
  rebuilt: ShoppingListItem[],
): ShoppingListItem[] {
  const prevPurchased = new Map<string, ShoppingListItem>();
  for (const item of previous) {
    if (item.isCustom) continue;
    if (item.isPurchased) prevPurchased.set(shoppingItemKey(item.name, item.unit), item);
  }

  for (const item of rebuilt) {
    const prev = prevPurchased.get(shoppingItemKey(item.name, item.unit));
    if (prev) {
      item.isPurchased = true;
      item.purchasedAt = prev.purchasedAt;
    }
  }

  const customItems = previous.filter((item) => item.isCustom);
  return [...rebuilt, ...customItems];
}
