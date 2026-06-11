// src/lib/validation.ts
// Small, dependency-free request-body guards. The point is to stop attacker
// controlled values from reaching MongoDB query filters or dotted update paths:
//  - a non-string id in a filter (`{ 'items.id': itemId }`) lets an object like
//    `{$ne:null}` act as an operator;
//  - an unvalidated `mealType`/`itemIndex` is interpolated into an update path
//    (`days.0.meals.${mealType}.${itemIndex}`), so a crafted value could write
//    to an unintended field of the document.

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export function isMealType(v: unknown): v is MealType {
  return typeof v === 'string' && (MEAL_TYPES as readonly string[]).includes(v);
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Coerce a body `itemIndex` into a safe array index. Accepts a non-negative
 * integer (or a numeric string), defaults to 0 when absent, and returns null
 * for anything else (caller should answer 400). The upper bound is a sanity cap
 * — no menu day has anywhere near this many items.
 */
export function safeItemIndex(v: unknown): number | null {
  if (v == null) return 0;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 1000) return null;
  return n;
}
