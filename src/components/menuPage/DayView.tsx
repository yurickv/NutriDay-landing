'use client';

import { MenuDay } from '@/types/weeklyMenu';
import { AIMeal, MealCategory } from '@/types/meals';
import { MealCard } from './MealCard';
import { DayMealProgress } from './DayMealProgress';
import { CalorieProgressBar } from './CalorieProgressBar';
import { MacroProgressBar } from './MacroProgressBar';
import { Clock, Zap } from 'lucide-react';

interface DayViewProps {
  day: MenuDay;
  goalCalories: number;
  onConsume: (dayLabel: string, mealType: MealCategory, snackIndex?: number, isConsumed?: boolean) => Promise<void>;
  onOpenDetail: (meal: AIMeal) => void;
  onOpenSwap: (meal: AIMeal, mealType: MealCategory, snackIndex?: number) => void;
}

function calcConsumedMacros(day: MenuDay) {
  const meals: AIMeal[] = [
    day.meals.breakfast,
    day.meals.lunch,
    day.meals.dinner,
    ...day.meals.snacks,
  ];
  return meals
    .filter((m) => m.isConsumed)
    .reduce(
      (acc, m) => ({
        calories: acc.calories + m.calories * m.servings,
        protein: acc.protein + m.protein * m.servings,
        fat: acc.fat + m.fat * m.servings,
        carbs: acc.carbs + m.carbs * m.servings,
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 },
    );
}

function calcGoalMacros(goalCalories: number) {
  return {
    protein: Math.round(goalCalories * 0.3 / 4),
    fat: Math.round(goalCalories * 0.25 / 9),
    carbs: Math.round(goalCalories * 0.45 / 4),
  };
}

export function DayView({ day, goalCalories, onConsume, onOpenDetail, onOpenSwap }: DayViewProps) {
  const allMeals: AIMeal[] = [day.meals.breakfast, day.meals.lunch, day.meals.dinner, ...day.meals.snacks];
  const consumedCount = allMeals.filter((m) => m.isConsumed).length;
  const macros = calcConsumedMacros(day);
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
              total={allMeals.length}
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
                onOpenDetail={onOpenDetail}
                onOpenSwap={onOpenSwap}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
