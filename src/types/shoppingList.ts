import { ShoppingCategory } from './meals';

export interface ShoppingListItem {
  id: string;
  name: string;
  quantity: number;
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
