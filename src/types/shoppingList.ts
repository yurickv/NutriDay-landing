import { ShoppingCategory } from './meals';

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number; // total for the whole week, in `unit`
  // Per-day-of-week breakdown, index 0 = Понеділок … 6 = Неділя. Sums of a
  // subset give a correct per-period total (Пн–Ср = [0..2], Чт–Нд = [3..6]),
  // so period views never double-count or drift from the weekly total.
  // Empty for manually added custom items (no menu day attribution).
  quantityByDay: number[];
  unit: string;
  shoppingCategory: ShoppingCategory;
  mealNames: string[];
  forDays: string[];
  isPurchased: boolean;
  purchasedAt: Date | null;
  isCustom: boolean;
}

export interface ShoppingList {
  _id: string;
  userEmail: string;
  weeklyMenuId: string;
  weekStartDate: Date;
  items: ShoppingListItem[];
  updatedAt: Date;
}

export type GroupedShoppingItems = Record<ShoppingCategory, ShoppingListItem[]>;
