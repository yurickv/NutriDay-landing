'use client';

import { MenuDay } from '@/types/weeklyMenu';
import { AIMeal, MealCategory } from '@/types/meals';
import { MealCard } from './MealCard';
import { CustomEntryCard } from './CustomEntryCard';
import { WaterTracker } from './WaterTracker';
import { DayMealProgress } from './DayMealProgress';
import { CalorieProgressBar } from './CalorieProgressBar';
import { MacroProgressBar } from './MacroProgressBar';
import { Clock, Zap, Plus } from 'lucide-react';

interface DayViewProps {
  day: MenuDay;
  dayDate: string;
  goalCalories: number;
  onConsume: (dayLabel: string, mealType: MealCategory, snackIndex?: number, isConsumed?: boolean, consumedWeight?: number | null) => Promise<void>;
  onOpenConsume: (meal: AIMeal, mealType: MealCategory, snackIndex?: number) => void;
  onOpenDetail: (meal: AIMeal) => void;
  onOpenSwap: (meal: AIMeal, mealType: MealCategory, snackIndex?: number) => void;
  onOpenAddCustom: (dayLabel: string) => void;
  onDeleteCustom: (dayLabel: string, entryId: string) => Promise<void>;
}

// Multiplier applied to a meal's per-serving macros for what the user actually ate.
// With a recorded consumedWeight we scale by grams (calories refer to one servingSize);
// otherwise fall back to the full planned portion (servings).
function consumedFactor(m: AIMeal): number {
  if (m.consumedWeight != null && m.consumedWeight > 0 && m.servingSize > 0) {
    return m.consumedWeight / m.servingSize;
  }
  return m.servings;
}

function calcConsumedMacros(day: MenuDay) {
  const meals: AIMeal[] = [
    day.meals.breakfast,
    day.meals.lunch,
    day.meals.dinner,
    ...day.meals.snacks,
  ];
  const fromMeals = meals
    .filter((m) => m.isConsumed)
    .reduce(
      (acc, m) => {
        const f = consumedFactor(m);
        return {
          calories: acc.calories + m.calories * f,
          protein: acc.protein + m.protein * f,
          fat: acc.fat + m.fat * f,
          carbs: acc.carbs + m.carbs * f,
        };
      },
      { calories: 0, protein: 0, fat: 0, carbs: 0 },
    );
  // Custom entries store absolute eaten values — add them directly, no factor.
  return (day.customEntries ?? []).reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      fat: acc.fat + e.fat,
      carbs: acc.carbs + e.carbs,
    }),
    fromMeals,
  );
}

function calcGoalMacros(goalCalories: number) {
  return {
    protein: Math.round(goalCalories * 0.3 / 4),
    fat: Math.round(goalCalories * 0.25 / 9),
    carbs: Math.round(goalCalories * 0.45 / 4),
  };
}

export function DayView({ day, dayDate, goalCalories, onConsume, onOpenConsume, onOpenDetail, onOpenSwap, onOpenAddCustom, onDeleteCustom }: DayViewProps) {
  const allMeals: AIMeal[] = [day.meals.breakfast, day.meals.lunch, day.meals.dinner, ...day.meals.snacks];
  const customEntries = day.customEntries ?? [];
  // Custom entries count both toward eaten calories and as "meals" for day progress.
  const consumedCount = allMeals.filter((m) => m.isConsumed).length + customEntries.length;
  const totalSlots = allMeals.length + customEntries.length;
  const raw = calcConsumedMacros(day);
  const macros = {
    calories: Math.round(raw.calories),
    protein: Math.round(raw.protein),
    fat: Math.round(raw.fat),
    carbs: Math.round(raw.carbs),
  };
  const goalMacros = calcGoalMacros(goalCalories);
  const isQuickDay = day.totalPrepMinutes <= 60;

  return (
    <div className="flex-1">
      {/* Sticky progress header */}
      <div className="sticky top-0 z-10">
        <CalorieProgressBar consumed={macros.calories} goal={goalCalories} />
        <MacroProgressBar
          consumed={{ protein: macros.protein, fat: macros.fat, carbs: macros.carbs }}
          goal={goalMacros}
        />
      </div>

      <div className="px-4 pt-4 pb-2 space-y-4">
        {/* Day header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              {day.dayLabel}
            </h2>
            <DayMealProgress
              consumed={consumedCount}
              total={totalSlots}
              isCompleted={day.isCompleted}
            />
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-neutral-500">
              {day.totalCalories} ккал
            </span>
            <div className="flex items-center gap-1 text-xs text-neutral-400">
              {isQuickDay ? (
                <>
                  <Zap size={11} className="text-yellow-500" aria-hidden="true" />
                  <span>Швидкий день</span>
                </>
              ) : (
                <>
                  <Clock size={11} aria-hidden="true" />
                  <span>{day.totalPrepMinutes} хв</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Meals */}
        <section aria-label="Сніданок">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">
            Сніданок
          </h3>
          <MealCard
            meal={day.meals.breakfast}
            mealType="breakfast"
            dayLabel={day.dayLabel}
            onConsume={onConsume}
            onOpenConsume={onOpenConsume}
            onOpenDetail={onOpenDetail}
            onOpenSwap={onOpenSwap}
          />
        </section>

        <section aria-label="Обід">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">
            Обід
          </h3>
          <MealCard
            meal={day.meals.lunch}
            mealType="lunch"
            dayLabel={day.dayLabel}
            onConsume={onConsume}
            onOpenConsume={onOpenConsume}
            onOpenDetail={onOpenDetail}
            onOpenSwap={onOpenSwap}
          />
        </section>

        <section aria-label="Вечеря">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">
            Вечеря
          </h3>
          <MealCard
            meal={day.meals.dinner}
            mealType="dinner"
            dayLabel={day.dayLabel}
            onConsume={onConsume}
            onOpenConsume={onOpenConsume}
            onOpenDetail={onOpenDetail}
            onOpenSwap={onOpenSwap}
          />
        </section>

        {day.meals.snacks.length > 0 && (
          <section aria-label="Перекус">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">
              Перекус
            </h3>
            {day.meals.snacks.map((snack, i) => (
              <MealCard
                key={i}
                meal={snack}
                mealType="snack"
                dayLabel={day.dayLabel}
                snackIndex={i}
                onConsume={onConsume}
                onOpenConsume={onOpenConsume}
                onOpenDetail={onOpenDetail}
                onOpenSwap={onOpenSwap}
              />
            ))}
          </section>
        )}

        {/* Custom eaten foods (outside the AI menu) */}
        <section aria-label="Мої страви">
          <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">
            Мої страви
          </h3>
          <div className="space-y-2">
            {customEntries.map((entry) => (
              <CustomEntryCard
                key={entry.id}
                entry={entry}
                onDelete={(entryId) => onDeleteCustom(day.dayLabel, entryId)}
              />
            ))}
            <button
              onClick={() => onOpenAddCustom(day.dayLabel)}
              className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 text-sm font-medium hover:border-orange-300 hover:text-orange-400 transition-colors"
            >
              <Plus size={16} />
              Додати свою страву
            </button>
          </div>
        </section>

        {/* Water tracker — per selected day */}
        <WaterTracker date={dayDate} />
      </div>
    </div>
  );
}
