'use client';

import { useState, useCallback, useRef } from 'react';
import { WeeklyMenu } from '@/types/weeklyMenu';
import { AIMeal, MealCategory } from '@/types/meals';
import { DayTabBar } from './DayTabBar';
import { DayView } from './DayView';
import { MealDetailSheet } from './MealDetailSheet';
import { ConsumePortionSheet } from './ConsumePortionSheet';
import { SwapMealPanel } from './SwapMealPanel';
import { MealRatingWidget } from './MealRatingWidget';
import { ToastContainer, ToastData } from '@/components/common/Toast';

interface WeeklyMenuViewProps {
  menu: WeeklyMenu;
  goalCalories: number;
  onMenuUpdate: () => void;
}

interface PendingRating {
  meal: AIMeal;
  mealType: MealCategory;
  dayLabel: string;
  snackIndex?: number;
}

export function WeeklyMenuView({ menu, goalCalories, onMenuUpdate }: WeeklyMenuViewProps) {
  // Find today's day or fallback to first
  const findTodayIndex = () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const idx = menu.days.findIndex((d) => {
      const dd = new Date(d.date);
      return `${dd.getFullYear()}-${dd.getMonth()}-${dd.getDate()}` === todayStr;
    });
    return idx >= 0 ? idx : 0;
  };

  const [activeDay, setActiveDay] = useState(findTodayIndex);
  const [detailMeal, setDetailMeal] = useState<AIMeal | null>(null);
  const [consumeContext, setConsumeContext] = useState<{
    meal: AIMeal;
    mealType: MealCategory;
    dayLabel: string;
    snackIndex?: number;
  } | null>(null);
  const [swapContext, setSwapContext] = useState<{
    meal: AIMeal;
    mealType: MealCategory;
    snackIndex?: number;
  } | null>(null);
  const [pendingRating, setPendingRating] = useState<PendingRating | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((message: string, emoji?: string, type: ToastData['type'] = 'success') => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, emoji, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleConsume = useCallback(async (
    dayLabel: string,
    mealType: MealCategory,
    snackIndex?: number,
    isConsumed = true,
    consumedWeight: number | null = null,
  ) => {
    const res = await fetch('/api/menu/meal/consume', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayLabel, mealType, snackIndex, isConsumed, consumedWeight }),
    });
    if (!res.ok) return;

    onMenuUpdate();

    if (isConsumed) {
      addToast('Відмічено!', '✅');
      // Find meal to offer rating
      const day = menu.days.find((d) => d.dayLabel === dayLabel);
      if (day) {
        let meal: AIMeal | null = null;
        if (mealType === 'snack') meal = day.meals.snacks[snackIndex ?? 0];
        else meal = day.meals[mealType];
        if (meal && !meal.rating) {
          // Show rating after a short delay
          setTimeout(() => setPendingRating({ meal, mealType, dayLabel, snackIndex }), 500);
        }
      }
    }
  }, [menu, onMenuUpdate, addToast]);

  const handleRate = useCallback(async (
    dayLabel: string,
    mealType: MealCategory,
    rating: 1 | 2 | 3,
    snackIndex?: number,
  ) => {
    await fetch('/api/menu/meal/rate', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayLabel, mealType, snackIndex, rating }),
    });
    onMenuUpdate();
    const emojis = { 1: '👎', 2: '😐', 3: '😍' };
    addToast('Дякуємо за оцінку!', emojis[rating]);
  }, [onMenuUpdate, addToast]);

  const handleSwap = useCallback(async (
    dayLabel: string,
    mealType: MealCategory,
    alternativeIndex: number,
    snackIndex?: number,
  ) => {
    const res = await fetch('/api/menu/meal/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dayLabel, mealType, snackIndex, alternativeIndex }),
    });
    if (!res.ok) return;
    onMenuUpdate();
    addToast('Страву замінено!', '🔄');
  }, [onMenuUpdate, addToast]);

  const currentDay = menu.days[activeDay];

  return (
    <>
      <div className="flex flex-col min-h-full">
        {/* Day tab bar */}
        <DayTabBar
          days={menu.days}
          activeIndex={activeDay}
          onSelect={setActiveDay}
        />

        {/* Day view */}
        {currentDay && (
          <DayView
            day={currentDay}
            goalCalories={goalCalories}
            onConsume={handleConsume}
            onOpenConsume={(meal, mealType, snackIndex) =>
              setConsumeContext({ meal, mealType, dayLabel: currentDay.dayLabel, snackIndex })
            }
            onOpenDetail={(meal) => setDetailMeal(meal)}
            onOpenSwap={(meal, mealType, snackIndex) =>
              setSwapContext({ meal, mealType, snackIndex })
            }
          />
        )}
      </div>

      {/* Meal detail sheet */}
      <MealDetailSheet
        meal={detailMeal}
        isOpen={!!detailMeal}
        onClose={() => setDetailMeal(null)}
      />

      {/* Consume portion sheet */}
      <ConsumePortionSheet
        meal={consumeContext?.meal ?? null}
        isOpen={!!consumeContext}
        onClose={() => setConsumeContext(null)}
        onConfirm={(consumedWeight) => {
          if (consumeContext) {
            const { dayLabel, mealType, snackIndex } = consumeContext;
            handleConsume(dayLabel, mealType, snackIndex, true, consumedWeight);
          }
          setConsumeContext(null);
        }}
      />

      {/* Swap panel */}
      <SwapMealPanel
        meal={swapContext?.meal ?? null}
        mealType={swapContext?.mealType ?? null}
        snackIndex={swapContext?.snackIndex}
        dayLabel={currentDay?.dayLabel ?? ''}
        isOpen={!!swapContext}
        onClose={() => setSwapContext(null)}
        onSwap={handleSwap}
      />

      {/* Rating widget */}
      {pendingRating && (
        <MealRatingWidget
          meal={pendingRating.meal}
          dayLabel={pendingRating.dayLabel}
          mealType={pendingRating.mealType}
          snackIndex={pendingRating.snackIndex}
          onRate={handleRate}
          onClose={() => setPendingRating(null)}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
