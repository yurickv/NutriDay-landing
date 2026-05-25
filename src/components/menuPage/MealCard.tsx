'use client';

import { useState, useRef } from 'react';
import { Check, RefreshCw, Clock } from 'lucide-react';
import { AIMeal, MealCategory } from '@/types/meals';

interface MealCardProps {
  meal: AIMeal;
  mealType: MealCategory;
  dayLabel: string;
  snackIndex?: number;
  onConsume: (dayLabel: string, mealType: MealCategory, snackIndex?: number, isConsumed?: boolean) => Promise<void>;
  onOpenDetail: (meal: AIMeal) => void;
  onOpenSwap: (meal: AIMeal, mealType: MealCategory, snackIndex?: number) => void;
}

const MEAL_LABELS: Record<MealCategory, string> = {
  breakfast: 'Сніданок',
  lunch: 'Обід',
  dinner: 'Вечеря',
  snack: 'Перекус',
};

export function MealCard({
  meal,
  mealType,
  dayLabel,
  snackIndex,
  onConsume,
  onOpenDetail,
  onOpenSwap,
}: MealCardProps) {
  const [loading, setLoading] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const handleConsume = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await onConsume(dayLabel, mealType, snackIndex, !meal.isConsumed);
      // Haptic feedback
      if ('vibrate' in navigator) navigator.vibrate(30);
    } finally {
      setLoading(false);
    }
  };

  // Swipe gesture support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > 70) {
      // Swipe right → consume
      onConsume(dayLabel, mealType, snackIndex, true);
    } else if (delta < -70) {
      // Swipe left → swap
      onOpenSwap(meal, mealType, snackIndex);
    }
    touchStartX.current = null;
  };

  return (
    <div
      role="article"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => onOpenDetail(meal)}
      className={`relative flex items-center gap-3 p-4 rounded-2xl shadow-sm cursor-pointer active:scale-[0.98] transition-all select-none ${
        meal.isConsumed
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          : 'bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800'
      }`}
      aria-label={`${MEAL_LABELS[mealType]}: ${meal.name}`}
    >
      {/* Emoji */}
      <span className={`text-3xl flex-shrink-0 ${meal.isConsumed ? 'opacity-60' : ''}`} aria-hidden="true">
        {meal.emoji}
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-bold leading-snug truncate ${meal.isConsumed ? 'text-neutral-400 line-through' : 'text-neutral-900 dark:text-neutral-100'}`}>
          {meal.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs font-semibold text-main">{meal.calories} ккал</span>
          <span className="text-xs text-neutral-400">·</span>
          <span className="text-xs text-neutral-400">{meal.protein}г Б</span>
          {meal.prepTimeMinutes > 0 && (
            <>
              <span className="text-xs text-neutral-400">·</span>
              <Clock size={11} className="text-neutral-400" aria-hidden="true" />
              <span className="text-xs text-neutral-400">{meal.prepTimeMinutes + meal.cookTimeMinutes} хв</span>
            </>
          )}
        </div>
        {meal.isSwapped && (
          <span className="inline-block mt-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">
            замінено
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {/* Swap button */}
        <button
          onClick={(e) => { e.stopPropagation(); onOpenSwap(meal, mealType, snackIndex); }}
          className="p-2 rounded-full text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Замінити страву"
        >
          <RefreshCw size={15} />
        </button>

        {/* Consume button */}
        <button
          onClick={handleConsume}
          disabled={loading}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
            meal.isConsumed
              ? 'bg-green-500 text-white'
              : 'border-2 border-neutral-300 dark:border-neutral-600 text-neutral-400 hover:border-green-400 hover:text-green-500'
          }`}
          aria-label={meal.isConsumed ? 'Відмінити відмітку' : 'Відмітити як з\'їдено'}
          aria-pressed={meal.isConsumed}
        >
          <Check size={16} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
