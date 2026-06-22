# Menu Nutrition Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Round menu ingredient weights to clean numbers (multiples of 10) and make custom-food BJU accurate via deterministic ingredient decomposition with an editable UI.

**Architecture:** Two fixes in the menu-nutrition domain. (1) A new unconditional "round + recompute" pass in `generateMenuWithAI.ts` rounds ingredient weights and recomputes macros from the deterministic `FOOD_TABLE`. (2) `parseCustomFood` switches to a hybrid: the LLM decomposes a dish into ingredients, code computes BJU from `FOOD_TABLE` when table coverage is high, otherwise falls back to the LLM's per-100g estimate. A new deterministic `/api/menu/food/compute` endpoint lets the UI recompute on ingredient edits without AI cost.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5, MongoDB, OpenAI SDK.

## Global Constraints

- Verification is `npx tsc --noEmit` + manual dev checks. **No test framework** is installed and none is added.
- **Never run `next build` while `next dev` is running** — it rewrites `.next/` and the dev server returns 500 on all routes. Use `npx tsc --noEmit` for type checks.
- All user-facing text is Ukrainian.
- MongoDB `$push` / untyped collection updates use `as any` cast (existing pattern).
- Nutrition values are per 100 g of raw/as-purchased product; `computeMealNutrition` already handles unit→grams conversion.
- AI calls stay server-side only (`OPENAI_API_KEY` never reaches the client).
- Commit after each task.

---

### Task 1: Detailed nutrition computation + per100 helper

**Files:**
- Modify: `src/lib/menu/foodNutrition.ts`

**Interfaces:**
- Consumes: existing `lookupFood`, `toGrams`, `FOOD_TABLE` (same file).
- Produces:
  - `interface NutritionDetailed { calories: number; protein: number; fat: number; carbs: number; totalGrams: number; matchedGrams: number; }`
  - `computeNutritionDetailed(ingredients: { name: string; quantity: number; unit: string }[]): NutritionDetailed`
  - `per100FromTotals(totals: { calories: number; protein: number; fat: number; carbs: number }, grams: number): NutritionPer100`
  - `computeMealNutrition(...)` keeps its existing signature/return (now a thin wrapper).

- [ ] **Step 1: Add the import for the shared per-100 type**

At the top of `src/lib/menu/foodNutrition.ts`, add:

```ts
import { NutritionPer100 } from '@/types/meals';
```

- [ ] **Step 2: Add `NutritionDetailed` and `computeNutritionDetailed`, refactor `computeMealNutrition`**

Replace the existing `computeMealNutrition` function (currently at `foodNutrition.ts:1319-1349`) with:

```ts
export interface NutritionDetailed {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  // Sum of grams of every ingredient we could convert to grams (toGrams > 0).
  totalGrams: number;
  // Grams of ingredients recognised in FOOD_TABLE or the zero-macro list.
  matchedGrams: number;
}

// Computes macros AND coverage info from an ingredient list. Coverage
// (matchedGrams / totalGrams) lets callers decide whether the deterministic
// result is trustworthy or they should fall back to an estimate.
export function computeNutritionDetailed(
  ingredients: { name: string; quantity: number; unit: string }[],
): NutritionDetailed {
  let protein = 0;
  let fat = 0;
  let carbs = 0;
  let totalGrams = 0;
  let matchedGrams = 0;

  for (const ing of ingredients) {
    const grams = toGrams(ing.quantity, ing.unit, ing.name);
    if (grams <= 0) continue;
    totalGrams += grams;

    const macros = lookupFood(ing.name);
    if (!macros) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[foodNutrition] no match for ingredient: "${ing.name}"`);
      }
      continue;
    }
    matchedGrams += grams;
    protein += (macros.protein / 100) * grams;
    fat += (macros.fat / 100) * grams;
    carbs += (macros.carbs / 100) * grams;
  }

  return {
    calories: Math.round(protein * 4 + fat * 9 + carbs * 4),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs),
    totalGrams,
    matchedGrams,
  };
}

// Computes absolute calories + macros for a dish from its ingredient list.
// Thin wrapper over computeNutritionDetailed (kept for existing callers).
export function computeMealNutrition(
  ingredients: { name: string; quantity: number; unit: string }[],
): { calories: number; protein: number; fat: number; carbs: number } {
  const d = computeNutritionDetailed(ingredients);
  return { calories: d.calories, protein: d.protein, fat: d.fat, carbs: d.carbs };
}

// Derives per-100g values from an absolute total and its gram weight.
export function per100FromTotals(
  totals: { calories: number; protein: number; fat: number; carbs: number },
  grams: number,
): NutritionPer100 {
  if (grams <= 0) return { calories: 0, protein: 0, fat: 0, carbs: 0 };
  const f = 100 / grams;
  return {
    calories: Math.round(totals.calories * f),
    protein: Math.round(totals.protein * f),
    fat: Math.round(totals.fat * f),
    carbs: Math.round(totals.carbs * f),
  };
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/menu/foodNutrition.ts
git commit -m "feat(menu): add computeNutritionDetailed + per100FromTotals helpers"
```

---

### Task 2: Round ingredient weights to 10 with recompute

**Files:**
- Modify: `src/lib/menu/generateMenuWithAI.ts`

**Interfaces:**
- Consumes: `computeMealNutrition` (already imported in this file).
- Produces: internal `roundQuantity`, `roundAndRecomputeMeal`; behavior change in `mapDays` and `scaleMealToCalories`.

- [ ] **Step 1: Add `roundQuantity` and `roundAndRecomputeMeal` helpers**

In `src/lib/menu/generateMenuWithAI.ts`, immediately above `scaleDayToTarget` (currently `generateMenuWithAI.ts:224`), add:

```ts
// Rounds an ingredient quantity to a "clean" number. Weight-based ingredients
// of 20 g/мл or more snap to the nearest 10 (so dish weights aren't like 342 g);
// small ones (spices, oil, yeast) keep finer granularity so they aren't distorted
// (e.g. 5 мл oil must not jump to 10). Count units ("шт") stay whole.
function roundQuantity(quantity: number, unit: string): number {
  const u = unit.trim().toLowerCase();
  if (u === 'шт' || u === 'шт.') return Math.max(1, Math.round(quantity));
  const isWeight = u === 'г' || u === 'гр' || u === 'мл';
  if (isWeight && quantity >= 20) return Math.max(10, Math.round(quantity / 10) * 10);
  if (isWeight) return Math.max(5, Math.round(quantity));
  return Math.max(1, Math.round(quantity));
}

// Rounds every ingredient weight, then RECOMPUTES the meal's calories/macros from
// the rounded weights via the deterministic table so the displayed numbers always
// match the listed ingredients. servingSize is rounded to the nearest 10.
function roundAndRecomputeMeal(meal: AIMeal): void {
  meal.ingredients = meal.ingredients.map((ing) => ({
    ...ing,
    quantity: roundQuantity(ing.quantity, ing.unit),
  }));
  const n = computeMealNutrition(meal.ingredients);
  meal.calories = n.calories;
  meal.protein = n.protein;
  meal.fat = n.fat;
  meal.carbs = n.carbs;
  meal.servingSize = Math.max(10, Math.round(meal.servingSize / 10) * 10);
}
```

- [ ] **Step 2: Add the round+recompute pass in `mapDays`**

In `mapDays`, after the `adjustDeficientDays(days, targetCalories);` call (currently `generateMenuWithAI.ts:336`) and before the "Pass 4 — compute final aggregate totals" loop, insert:

```ts
  // Pass 3.5 — round ingredient weights to clean numbers (≥20 g/мл → nearest 10)
  //            and recompute macros from the rounded weights so the numbers match.
  for (const day of days) {
    const allMeals = [...day.meals.breakfast, ...day.meals.lunch, ...day.meals.dinner, ...day.meals.snacks];
    for (const meal of allMeals) roundAndRecomputeMeal(meal);
  }
```

- [ ] **Step 3: Make `scaleMealToCalories` always round+recompute (swap path)**

Replace the entire `scaleMealToCalories` function (currently `generateMenuWithAI.ts:397-413`) with:

```ts
/**
 * Scales a meal's ingredient quantities so its calories approach targetCalories,
 * then rounds weights to clean numbers and recomputes macros from the table.
 * The round+recompute runs UNCONDITIONALLY so swapped meals get clean weights
 * even when no scaling was needed.
 */
export function scaleMealToCalories(meal: AIMeal, targetCalories: number): void {
  if (targetCalories > 0 && meal.calories > 0) {
    const k = targetCalories / meal.calories;
    if (Math.abs(k - 1) > 0.03 && k >= 0.5 && k <= 2.0) {
      meal.servingSize = Math.round(meal.servingSize * k);
      meal.ingredients = meal.ingredients.map((ing) => ({
        ...ing,
        quantity: ing.unit === 'шт'
          ? Math.max(1, Math.round(ing.quantity * k))
          : Math.max(5, Math.round(ing.quantity * k)),
      }));
    }
  }
  roundAndRecomputeMeal(meal);
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 5: Manual verification (when an OpenAI key is configured)**

Run `npm run dev`, generate a menu, open any day, and confirm in the UI (or via the stored `weekly_menus` document) that every weight-unit ingredient of 20 g/мл or more is a multiple of 10, small items (spices/oil) are untouched, and each dish's `servingSize` is a multiple of 10. If no key is available, rely on the type-check and code review for this task.

- [ ] **Step 6: Commit**

```bash
git add src/lib/menu/generateMenuWithAI.ts
git commit -m "feat(menu): round ingredient weights to 10 and recompute macros"
```

---

### Task 3: Deterministic compute endpoint

**Files:**
- Create: `src/app/api/menu/food/compute/route.ts`

**Interfaces:**
- Consumes: `computeNutritionDetailed`, `per100FromTotals` (Task 1); `readSessionUserId` from `@/lib/auth/session`; `MealIngredient` from `@/types/meals`.
- Produces: `POST /api/menu/food/compute` → `{ calories, protein, fat, carbs, grams, per100 }`.

- [ ] **Step 1: Create the route**

Create `src/app/api/menu/food/compute/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { computeNutritionDetailed, per100FromTotals } from '@/lib/menu/foodNutrition';
import { MealIngredient } from '@/types/meals';

interface ComputeBody {
  ingredients: MealIngredient[];
}

// Deterministic nutrition computation from an ingredient list. No OpenAI call,
// so it only needs a valid session (not an active subscription) — the UI calls
// it on every ingredient edit without incurring AI cost.
export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as ComputeBody;
  const list = Array.isArray(body.ingredients) ? body.ingredients : [];
  if (list.length === 0 || list.length > 40) {
    return NextResponse.json({ error: 'Некоректний список інгредієнтів' }, { status: 400 });
  }

  const ingredients = list.slice(0, 40).map((i) => ({
    name: String(i.name ?? '').slice(0, 60),
    quantity: Math.max(0, Math.min(5000, Math.round(Number(i.quantity) || 0))),
    unit: String(i.unit ?? 'г').slice(0, 8),
  }));

  const d = computeNutritionDetailed(ingredients);
  const per100 = per100FromTotals(d, d.totalGrams);

  return NextResponse.json({
    calories: d.calories,
    protein: d.protein,
    fat: d.fat,
    carbs: d.carbs,
    grams: d.totalGrams,
    per100,
  });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 3: Manual verification**

With `npm run dev` running and a logged-in session, in the browser devtools console run:

```js
await fetch('/api/menu/food/compute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ingredients: [
    { name: 'куряче філе', quantity: 150, unit: 'г', shoppingCategory: 'meat' },
    { name: 'гречана крупа', quantity: 80, unit: 'г', shoppingCategory: 'grains' },
  ] }),
}).then(r => r.json());
```

Expected: an object with non-zero `calories`, `protein`, `fat`, `carbs`, `grams: 230`, and a `per100` object.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/menu/food/compute/route.ts
git commit -m "feat(menu): deterministic food/compute endpoint"
```

---

### Task 4: Hybrid `parseCustomFood`

**Files:**
- Modify: `src/lib/menu/parseCustomFood.ts`

**Interfaces:**
- Consumes: `computeNutritionDetailed`, `per100FromTotals` (Task 1); `MealIngredient`, `NutritionPer100` from `@/types/meals`.
- Produces: extended `ParsedFood` with `ingredients: MealIngredient[]` and `method: 'ingredients' | 'estimate'`.

- [ ] **Step 1: Update imports and the `ParsedFood` interface**

Replace the top imports and `ParsedFood` interface (currently `parseCustomFood.ts:1-19`) with:

```ts
import OpenAI from 'openai';
import { MealIngredient, NutritionPer100 } from '@/types/meals';
import { computeNutritionDetailed, per100FromTotals } from './foodNutrition';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Result of parsing a food name. When the LLM's ingredient decomposition is well
// covered by the nutrition table, calories/macros are computed deterministically
// (method 'ingredients'); otherwise we fall back to the LLM's per-100g estimate
// (method 'estimate'). `error` is set when the food can't be recognised at all.
export interface ParsedFood {
  name: string;
  emoji: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  grams: number;
  per100: NutritionPer100 | null;
  ingredients: MealIngredient[];
  method: 'ingredients' | 'estimate';
  error: string | null;
}

// Below this table-coverage ratio (matched grams / total grams) the deterministic
// computation is considered unreliable and we use the LLM per-100g estimate.
const COVERAGE_THRESHOLD = 0.6;
```

- [ ] **Step 2: Replace the system prompt**

Replace `SYSTEM_PROMPT` (currently `parseCustomFood.ts:21-33`) with:

```ts
const SYSTEM_PROMPT = `You are a nutrition expert. The user gives the name of a dish (in Ukrainian) they ate and its eaten weight in grams.

Do TWO things:
1. Decompose the dish into its main ingredients with realistic weights that together roughly equal the eaten weight. Use raw / as-purchased weights. Unit "г" for solids, "мл" for liquids, "шт" only for naturally countable items (e.g. eggs).
2. Also provide your own fallback estimate of the nutrition PER 100 g of the READY (cooked) dish.

Reply with ONLY valid JSON (no markdown, no commentary) exactly matching this schema:
{
  "name": "коротка назва страви, ≤30 символів, українською",
  "emoji": "один доречний food-емодзі",
  "ingredients": [{ "name": "...", "quantity": 0, "unit": "г", "shoppingCategory": "other" }],
  "per100": { "calories": 0, "protein": 0, "fat": 0, "carbs": 0 }
}
shoppingCategory values: vegetables|fruits|meat|fish|dairy|grains|legumes|oils|spices|other

RULES:
- All text values MUST be in Ukrainian.
- Ingredient names MUST be simple product names (e.g. "куряче філе", "гречана крупа", "олія соняшникова", "морква") so they can be matched against a nutrition table.
- "per100" is the nutrition of 100 g of the READY dish. Round all numbers to integers.
- Return { "error": "коротке пояснення українською" } ONLY if the text is not food at all or is impossible to understand (gibberish).`;
```

- [ ] **Step 3: Add `normalizeIngredients` helper**

Immediately after the existing `normalizePer100` function (currently ends `parseCustomFood.ts:54`), add:

```ts
function normalizeIngredients(raw: unknown): MealIngredient[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 40)
    .map((r) => {
      const i = (r ?? {}) as Record<string, unknown>;
      return {
        name: String(i.name ?? '').slice(0, 60),
        quantity: Math.max(0, Math.round(Number(i.quantity) || 0)),
        unit: String(i.unit ?? 'г').slice(0, 8),
        shoppingCategory:
          (i.shoppingCategory as MealIngredient['shoppingCategory']) ?? 'other',
      };
    })
    .filter((i) => i.name.length > 0 && i.quantity > 0);
}
```

- [ ] **Step 4: Update `errorResult` to include the new fields**

Replace `errorResult` (currently `parseCustomFood.ts:56-61`) with:

```ts
function errorResult(message: string): ParsedFood {
  return {
    name: '', emoji: '🍽️', calories: 0, protein: 0, fat: 0, carbs: 0,
    grams: 0, per100: null, ingredients: [], method: 'estimate', error: message,
  };
}
```

- [ ] **Step 5: Rewrite `parseCustomFood` body with the hybrid decision**

Replace the `parseCustomFood` function body (currently `parseCustomFood.ts:82-121`, keep the JSDoc above it) with:

```ts
export async function parseCustomFood(text: string, grams: number): Promise<ParsedFood> {
  const g = Math.max(1, Math.round(grams) || 0);
  const userContent = `Страва: ${text}\nВага з'їденої порції: ${g} г`;
  let lastErr: unknown = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const content = await callOpenAI(userContent);
      const raw = JSON.parse(content) as Record<string, unknown>;

      if (typeof raw.error === 'string' && raw.error.trim()) {
        return errorResult(raw.error.trim());
      }

      const name = String(raw.name ?? text).slice(0, 30);
      const emoji = String(raw.emoji ?? '🍽️');
      const ingredients = normalizeIngredients(raw.ingredients);
      const llmPer100 = normalizePer100(raw.per100);

      // Preferred path: deterministic table computation when coverage is high.
      if (ingredients.length > 0) {
        const d = computeNutritionDetailed(ingredients);
        const coverage = d.totalGrams > 0 ? d.matchedGrams / d.totalGrams : 0;
        if (coverage >= COVERAGE_THRESHOLD && d.calories > 0) {
          return {
            name,
            emoji,
            calories: d.calories,
            protein: d.protein,
            fat: d.fat,
            carbs: d.carbs,
            grams: d.totalGrams,
            per100: per100FromTotals(d, d.totalGrams),
            ingredients,
            method: 'ingredients',
            error: null,
          };
        }
      }

      // Fallback: scale the LLM's per-100g estimate to the eaten weight.
      if (!llmPer100) {
        lastErr = new Error('No usable nutrition (low coverage and no per100)');
        continue;
      }
      const f = g / 100;
      return {
        name,
        emoji,
        calories: Math.round(llmPer100.calories * f),
        protein: Math.round(llmPer100.protein * f),
        fat: Math.round(llmPer100.fat * f),
        carbs: Math.round(llmPer100.carbs * f),
        grams: g,
        per100: llmPer100,
        ingredients,
        method: 'estimate',
        error: null,
      };
    } catch (err) {
      lastErr = err;
    }
  }

  console.error('parseCustomFood failed:', lastErr);
  return errorResult('Не вдалося розпізнати страву. Введіть дані вручну.');
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 7: Manual verification (when an OpenAI key is configured)**

With `npm run dev` and an active subscription session, in devtools console:

```js
await fetch('/api/menu/food/parse', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'гречка з куркою', grams: 300 }),
}).then(r => r.json());
```

Expected: `parsed.method === 'ingredients'`, a non-empty `parsed.ingredients` array, and plausible calories/BJU. A clearly exotic dish (e.g. "екзотичний тайський десерт") should return `method: 'estimate'`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/menu/parseCustomFood.ts
git commit -m "feat(menu): hybrid custom-food parsing via ingredient decomposition"
```

---

### Task 5: Persist ingredients on a custom entry

**Files:**
- Modify: `src/types/meals.ts`
- Modify: `src/app/api/menu/meal/custom/route.ts`

**Interfaces:**
- Consumes: `MealIngredient` (already exported from `@/types/meals`).
- Produces: `CustomEntry.ingredients?: MealIngredient[]`; the POST route persists a sanitized `ingredients` array.

- [ ] **Step 1: Add `ingredients` to `CustomEntry`**

In `src/types/meals.ts`, inside the `CustomEntry` interface (currently `meals.ts:71-83`), add this field right after `per100`:

```ts
  ingredients?: MealIngredient[]; // decomposition when method='ingredients' (optional)
```

- [ ] **Step 2: Add `MealIngredient` to the type import**

At the top of `src/app/api/menu/meal/custom/route.ts`, change the existing import (currently `route.ts:6`) from:

```ts
import { CustomEntry } from '@/types/meals';
```

to:

```ts
import { CustomEntry, MealIngredient } from '@/types/meals';
```

- [ ] **Step 3: Sanitize and store `ingredients` in the POST route**

In `src/app/api/menu/meal/custom/route.ts`, inside `POST`, replace the `newEntry` object literal (currently `route.ts:54-74`) with one that first builds a sanitized `ingredients` array and adds it to the entry:

```ts
  const rawIngredients = Array.isArray(entry.ingredients) ? entry.ingredients : [];
  const ingredients: MealIngredient[] = rawIngredients
    .slice(0, 40)
    .map((i) => ({
      name: String(i?.name ?? '').slice(0, 60),
      quantity: num(i?.quantity),
      unit: String(i?.unit ?? 'г').slice(0, 8),
      shoppingCategory: (i?.shoppingCategory as MealIngredient['shoppingCategory']) ?? 'other',
    }))
    .filter((i) => i.name.length > 0 && i.quantity > 0);

  const gramsRaw = num(entry.grams);
  const newEntry: CustomEntry = {
    id: crypto.randomUUID(),
    name: String(entry.name).trim().slice(0, 30),
    emoji: String(entry.emoji ?? '🍽️').slice(0, 8) || '🍽️',
    calories: num(entry.calories),
    protein: num(entry.protein),
    fat: num(entry.fat),
    carbs: num(entry.carbs),
    grams: gramsRaw > 0 ? gramsRaw : null,
    per100:
      entry.per100 && typeof entry.per100 === 'object'
        ? {
            calories: num(entry.per100.calories),
            protein: num(entry.per100.protein),
            fat: num(entry.per100.fat),
            carbs: num(entry.per100.carbs),
          }
        : null,
    ingredients: ingredients.length > 0 ? ingredients : undefined,
    source: entry.source === 'manual' ? 'manual' : 'ai',
    createdAt: new Date(),
  };
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/meals.ts src/app/api/menu/meal/custom/route.ts
git commit -m "feat(menu): persist ingredient decomposition on custom entries"
```

---

### Task 6: Editable ingredient breakdown in AddCustomFoodSheet

**Files:**
- Modify: `src/components/menuPage/AddCustomFoodSheet.tsx`

**Interfaces:**
- Consumes: `POST /api/menu/food/parse` (now returns `ingredients`, `method`); `POST /api/menu/food/compute` (Task 3); `CustomEntry`, `MealIngredient`, `NutritionPer100` from `@/types/meals`.
- Produces: a two-mode edit step — ingredient editor (`method==='ingredients'`) vs. the existing weight-stepper/manual editor.

- [ ] **Step 1: Replace the component with the two-mode version**

Replace the entire contents of `src/components/menuPage/AddCustomFoodSheet.tsx` with:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Minus, Plus, Sparkles, Pencil, Scale, Trash2 } from 'lucide-react';
import { BottomSheet } from '@/components/common/BottomSheet';
import { CustomEntry, MealIngredient, NutritionPer100 } from '@/types/meals';

interface AddCustomFoodSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (entry: Omit<CustomEntry, 'id' | 'createdAt'>) => Promise<void>;
}

// Shape returned by POST /api/menu/food/parse.
interface ParsedResponse {
  name: string;
  emoji: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  grams: number;
  per100: NutritionPer100 | null;
  ingredients: MealIngredient[];
  method: 'ingredients' | 'estimate';
  error: string | null;
}

const STEP = 10; // grams

interface Draft {
  name: string;
  emoji: string;
  grams: number; // 0 = вага не вказана
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  per100: NutritionPer100 | null;
  ingredients: MealIngredient[];
  mode: 'ingredients' | 'estimate';
  source: 'ai' | 'manual';
}

const EMPTY_DRAFT: Draft = {
  name: '',
  emoji: '🍽️',
  grams: 0,
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  per100: null,
  ingredients: [],
  mode: 'estimate',
  source: 'manual',
};

function clampNum(v: string): number {
  const n = Math.round(Number(v) || 0);
  return n >= 0 ? n : 0;
}

export function AddCustomFoodSheet({ isOpen, onClose, onAdd }: AddCustomFoodSheetProps) {
  const [step, setStep] = useState<'input' | 'edit'>('input');
  const [text, setText] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const computeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset everything whenever the sheet is (re)opened.
  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setText('');
      setWeight('');
      setLoading(false);
      setSaving(false);
      setRecomputing(false);
      setNote(null);
      setDraft(EMPTY_DRAFT);
    }
  }, [isOpen]);

  // Clear any pending debounce on unmount.
  useEffect(() => () => {
    if (computeTimer.current) clearTimeout(computeTimer.current);
  }, []);

  const handleParse = async () => {
    const trimmed = text.trim();
    const grams = Math.round(Number(weight));
    if (!trimmed || !(grams > 0)) return;
    setLoading(true);
    setNote(null);
    try {
      const res = await fetch('/api/menu/food/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, grams }),
      });
      const data = (await res.json()) as { parsed?: ParsedResponse };
      const p = data.parsed;

      if (!res.ok || !p || p.error) {
        setDraft({ ...EMPTY_DRAFT, name: trimmed.slice(0, 30), grams });
        setNote(p?.error ?? 'Не вдалося розпізнати. Введіть БЖВ вручну.');
      } else {
        setDraft({
          name: p.name || trimmed.slice(0, 30),
          emoji: p.emoji || '🍽️',
          grams: p.grams || grams,
          calories: p.calories,
          protein: p.protein,
          fat: p.fat,
          carbs: p.carbs,
          per100: p.per100,
          ingredients: p.ingredients ?? [],
          mode: p.method === 'ingredients' && (p.ingredients?.length ?? 0) > 0 ? 'ingredients' : 'estimate',
          source: 'ai',
        });
      }
      setStep('edit');
    } catch {
      setDraft({ ...EMPTY_DRAFT, name: trimmed.slice(0, 30), grams });
      setNote('Помилка зʼєднання. Введіть БЖВ вручну.');
      setStep('edit');
    } finally {
      setLoading(false);
    }
  };

  // Debounced deterministic recompute from the current ingredient list.
  const scheduleRecompute = (ingredients: MealIngredient[]) => {
    if (computeTimer.current) clearTimeout(computeTimer.current);
    if (ingredients.length === 0) return;
    setRecomputing(true);
    computeTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/menu/food/compute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ingredients }),
        });
        if (res.ok) {
          const c = (await res.json()) as {
            calories: number; protein: number; fat: number; carbs: number;
            grams: number; per100: NutritionPer100;
          };
          setDraft((d) => ({
            ...d,
            calories: c.calories,
            protein: c.protein,
            fat: c.fat,
            carbs: c.carbs,
            grams: c.grams,
            per100: c.per100,
          }));
        }
      } finally {
        setRecomputing(false);
      }
    }, 400);
  };

  const updateIngredient = (idx: number, field: 'name' | 'quantity', value: string) => {
    setDraft((d) => {
      const ingredients = d.ingredients.map((ing, i) =>
        i === idx
          ? { ...ing, [field]: field === 'quantity' ? clampNum(value) : value.slice(0, 60) }
          : ing,
      );
      scheduleRecompute(ingredients);
      return { ...d, ingredients };
    });
  };

  const removeIngredient = (idx: number) => {
    setDraft((d) => {
      const ingredients = d.ingredients.filter((_, i) => i !== idx);
      scheduleRecompute(ingredients);
      return { ...d, ingredients };
    });
  };

  const addIngredient = () => {
    setDraft((d) => ({
      ...d,
      ingredients: [...d.ingredients, { name: '', quantity: 0, unit: 'г', shoppingCategory: 'other' }],
    }));
  };

  const setGrams = (next: number) => {
    const grams = Math.max(0, next);
    setDraft((d) => {
      if (d.per100 && grams > 0) {
        const f = grams / 100;
        return {
          ...d,
          grams,
          calories: Math.round(d.per100.calories * f),
          protein: Math.round(d.per100.protein * f),
          fat: Math.round(d.per100.fat * f),
          carbs: Math.round(d.per100.carbs * f),
        };
      }
      return { ...d, grams };
    });
  };

  const handleManualField = (field: 'name' | 'emoji' | 'calories' | 'protein' | 'fat' | 'carbs', value: string) => {
    setDraft((d) => {
      if (field === 'name') return { ...d, name: value.slice(0, 30) };
      if (field === 'emoji') return { ...d, emoji: value.slice(0, 8) };
      return { ...d, [field]: clampNum(value), per100: null };
    });
  };

  const handleSave = async () => {
    if (!draft.name.trim() || saving) return;
    setSaving(true);
    try {
      await onAdd({
        name: draft.name.trim(),
        emoji: draft.emoji || '🍽️',
        calories: draft.calories,
        protein: draft.protein,
        fat: draft.fat,
        carbs: draft.carbs,
        grams: draft.grams > 0 ? draft.grams : null,
        per100: draft.per100,
        ingredients: draft.mode === 'ingredients' && draft.ingredients.length > 0 ? draft.ingredients : undefined,
        source: draft.source,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const macroSummary = (
    <div className="grid grid-cols-4 gap-2">
      {([
        { key: 'calories', label: 'Ккал' },
        { key: 'protein', label: 'Б, г' },
        { key: 'fat', label: 'Ж, г' },
        { key: 'carbs', label: 'В, г' },
      ] as const).map(({ key, label }) => (
        <div key={key} className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-semibold text-neutral-400 uppercase">{label}</span>
          <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{draft[key]}</span>
        </div>
      ))}
    </div>
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Додати свою страву">
      {step === 'input' ? (
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-neutral-500">
            Вкажіть назву страви та її вагу — AI оцінить калорії та БЖВ, які можна підправити.
          </p>

          <div className="space-y-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Назва страви, напр.: гречка з куркою"
              autoFocus
              maxLength={200}
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-orange-400"
            />
            <div className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus-within:border-orange-400">
              <input
                type="number"
                inputMode="numeric"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Вага порції"
                min={1}
                className="flex-1 min-w-0 bg-transparent text-sm text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none"
              />
              <span className="text-sm font-semibold text-neutral-400">г</span>
            </div>
          </div>

          <p className="text-[11px] text-neutral-400 flex items-start gap-1.5">
            <Scale size={13} className="mt-0.5 flex-shrink-0" />
            Точна вага страви робить підрахунок калорій і БЖВ значно точнішим.
          </p>

          <button
            onClick={handleParse}
            disabled={!text.trim() || !(Number(weight) > 0) || loading}
            className="w-full flex items-center justify-center gap-2 bg-main text-white font-bold py-3.5 rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            <Sparkles size={18} />
            {loading ? 'Рахуємо…' : 'Розрахувати'}
          </button>
          <button
            onClick={() => {
              const grams = Math.round(Number(weight)) || 0;
              setDraft({ ...EMPTY_DRAFT, name: text.trim().slice(0, 30), grams });
              setNote(null);
              setStep('edit');
            }}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 py-1"
          >
            <Pencil size={12} />
            Ввести вручну
          </button>
        </div>
      ) : (
        <div className="px-5 py-4 space-y-4">
          {note && (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2">
              {note}
            </p>
          )}

          {/* Name + emoji */}
          <div className="flex gap-2">
            <input
              type="text"
              value={draft.emoji}
              onChange={(e) => handleManualField('emoji', e.target.value)}
              className="w-14 text-center text-2xl px-2 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:border-orange-400"
              aria-label="Емодзі"
            />
            <input
              type="text"
              value={draft.name}
              onChange={(e) => handleManualField('name', e.target.value)}
              placeholder="Назва страви"
              maxLength={30}
              className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-orange-400"
            />
          </div>

          {draft.mode === 'ingredients' ? (
            <>
              {/* Editable ingredient list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-500">Інгредієнти</span>
                  <span className="text-[11px] text-neutral-400">
                    {recomputing ? 'Перерахунок…' : `${draft.grams} г разом`}
                  </span>
                </div>
                {draft.ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                      placeholder="Інгредієнт"
                      className="flex-1 min-w-0 text-sm px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-orange-400"
                    />
                    <div className="flex items-center gap-1 w-24 px-2 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus-within:border-orange-400">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={ing.quantity}
                        onChange={(e) => updateIngredient(idx, 'quantity', e.target.value)}
                        className="w-full min-w-0 bg-transparent text-sm text-right text-neutral-800 dark:text-neutral-200 focus:outline-none"
                        aria-label="Кількість"
                      />
                      <span className="text-[11px] font-semibold text-neutral-400">{ing.unit}</span>
                    </div>
                    <button
                      onClick={() => removeIngredient(idx)}
                      className="p-2 text-neutral-400 hover:text-red-500"
                      aria-label="Видалити інгредієнт"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addIngredient}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-neutral-500 hover:text-orange-500 py-2 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700"
                >
                  <Plus size={14} />
                  Додати інгредієнт
                </button>
              </div>

              {/* Read-only computed totals */}
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-3">{macroSummary}</div>
            </>
          ) : (
            <>
              {/* Weight stepper */}
              <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-3">
                <button
                  onClick={() => setGrams(draft.grams - STEP)}
                  disabled={draft.grams <= 0}
                  className="w-10 h-10 rounded-full bg-white dark:bg-neutral-700 shadow flex items-center justify-center disabled:opacity-40"
                  aria-label="Зменшити вагу"
                >
                  <Minus size={16} />
                </button>
                <div className="text-center">
                  <div className="flex items-baseline gap-1 justify-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={draft.grams}
                      onChange={(e) => setGrams(Math.max(0, Number(e.target.value) || 0))}
                      className="w-20 bg-transparent text-center text-2xl font-bold text-neutral-900 dark:text-neutral-100 focus:outline-none"
                      aria-label="Вага в грамах"
                    />
                    <span className="text-sm font-semibold text-neutral-400">г</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {draft.per100 ? 'вага перераховує калорії' : 'вага порції'}
                  </p>
                </div>
                <button
                  onClick={() => setGrams(draft.grams + STEP)}
                  className="w-10 h-10 rounded-full bg-white dark:bg-neutral-700 shadow flex items-center justify-center"
                  aria-label="Збільшити вагу"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Editable calories + macros */}
              <div className="grid grid-cols-4 gap-2">
                {([
                  { key: 'calories', label: 'Ккал' },
                  { key: 'protein', label: 'Б, г' },
                  { key: 'fat', label: 'Ж, г' },
                  { key: 'carbs', label: 'В, г' },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-neutral-400 text-center uppercase">
                      {label}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={draft[key]}
                      onChange={(e) => handleManualField(key, e.target.value)}
                      className="w-full text-center text-sm font-bold px-1 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-orange-400"
                    />
                  </label>
                ))}
              </div>
            </>
          )}

          {/* Confirm */}
          <button
            onClick={handleSave}
            disabled={!draft.name.trim() || saving || recomputing}
            className="w-full flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-3.5 rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            <Check size={18} strokeWidth={3} />
            {saving ? 'Додаємо…' : 'Додати'}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 3: Manual verification (when an OpenAI key is configured)**

Run `npm run dev`, open the menu page, tap "Додати свою страву", enter "гречка з куркою" / 300 г, and confirm:
- the edit step shows an editable ingredient list with weights and a read-only computed BJU summary;
- editing a weight or removing an ingredient updates the totals (debounced "Перерахунок…" appears briefly);
- an unrecognised dish falls back to the weight-stepper + editable BJU fields;
- "Ввести вручну" still opens the manual editor;
- saving adds the entry and it appears in the day's "Мої страви" section.

- [ ] **Step 4: Commit**

```bash
git add src/components/menuPage/AddCustomFoodSheet.tsx
git commit -m "feat(menu): editable ingredient breakdown for custom food"
```

---

## Self-Review notes

- **Spec coverage:** Section A → Tasks 1–2; Section B → Tasks 1, 3, 4; Section C → Tasks 5–6. All spec sections covered.
- **Type consistency:** `computeNutritionDetailed`, `per100FromTotals`, `ParsedFood.method`/`ingredients`, `Draft.mode`, and `CustomEntry.ingredients` are defined once and reused with the same names/shapes across tasks.
- **Verification:** Per the agreed approach (no test framework), every task ends with `npx tsc --noEmit` plus manual dev checks; AI-dependent checks are flagged as requiring a configured `OPENAI_API_KEY`.
