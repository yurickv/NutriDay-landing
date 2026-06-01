'use client';

import { useState, useRef } from 'react';
import { Check, RefreshCw, Clock, Smile } from 'lucide-react';
import { AIMeal, MealCategory } from '@/types/meals';

interface MealCardProps {
  meal: AIMeal;
  mealType: MealCategory;
  dayLabel: string;
  itemIndex?: number;
  onConsume: (dayLabel: string, mealType: MealCategory, itemIndex?: number, isConsumed?: boolean, consumedWeight?: number | null) => Promise<void>;
  onOpenConsume: (meal: AIMeal, mealType: MealCategory, itemIndex?: number) => void;
  onOpenDetail: (meal: AIMeal) => void;
  onOpenSwap: (meal: AIMeal, mealType: MealCategory, itemIndex?: number) => void;
  onRate: (dayLabel: string, mealType: MealCategory, rating: 1 | 2 | 3, itemIndex?: number) => Promise<void>;
}

const RATING_EMOJIS: Record<1 | 2 | 3, string> = { 1: '👎', 2: '😐', 3: '😍' };

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
  itemIndex,
  onConsume,
  onOpenConsume,
  onOpenDetail,
  onOpenSwap,
  onRate,
}: MealCardProps) {
  const [loading, setLoading] = useState(false);
  const [showRatingPicker, setShowRatingPicker] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const handleRate = async (rating: 1 | 2 | 3) => {
    setRatingLoading(true);
    try {
      await onRate(dayLabel, mealType, rating, itemIndex);
      setShowRatingPicker(false);
    } finally {
      setRatingLoading(false);
    }
  };

  const handleConsume = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (meal.isConsumed) {
      // Toggle off directly
      setLoading(true);
      try {
        await onConsume(dayLabel, mealType, itemIndex, false);
        if ('vibrate' in navigator) navigator.vibrate(30);
      } finally {
        setLoading(false);
      }
      return;
    }
    // Mark as eaten → ask for the actual portion weight first
    if (meal.servingSize > 0) {
      onOpenConsume(meal, mealType, itemIndex);
    } else {
      setLoading(true);
      try {
        await onConsume(dayLabel, mealType, itemIndex, true);
        if ('vibrate' in navigator) navigator.vibrate(30);
      } finally {
        setLoading(false);
      }
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
      onConsume(dayLabel, mealType, itemIndex, true);
    } else if (delta < -70) {
      // Swipe left → swap
      onOpenSwap(meal, mealType, itemIndex);
    }
    touchStartX.current = null;
  };

  return (
    <div
      role="article"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => onOpenDetail(meal)}
      className={`relative flex flex-col p-4 rounded-2xl shadow-sm cursor-pointer active:scale-[0.98] transition-all select-none ${
        meal.isConsumed
          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          : 'bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800'
      }`}
      aria-label={`${MEAL_LABELS[mealType]}: ${meal.name}`}
    >
      <div className="flex items-center gap-3">
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
            {meal.servingSize > 0 && (
              <>
                <span className="text-xs text-neutral-400">·</span>
                <span className="text-xs text-neutral-400">{meal.servingSize} г</span>
              </>
            )}
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
          <div className="flex items-center gap-1.5 flex-wrap">
            {meal.isSwapped && (
              <span className="inline-block mt-0.5 text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">
                замінено
              </span>
            )}
            {meal.isConsumed && meal.consumedWeight != null && (
              <span className="inline-block mt-0.5 text-[10px] font-semibold text-green-600 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded-full">
                з&apos;їдено {meal.consumedWeight} г
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Rating: show emoji if already rated, or rate button if consumed and unrated */}
          {meal.isConsumed && (
            meal.rating ? (
              <span className="text-lg leading-none" aria-label={`Оцінка: ${RATING_EMOJIS[meal.rating as 1 | 2 | 3]}`}>
                {RATING_EMOJIS[meal.rating as 1 | 2 | 3]}
              </span>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setShowRatingPicker((v) => !v); }}
                className={`p-2 rounded-full transition-colors ${
                  showRatingPicker
                    ? 'text-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
                aria-label="Оцінити страву"
                aria-expanded={showRatingPicker}
              >
                <Smile size={15} />
              </button>
            )
          )}

          {/* Swap button */}
          <button
            onClick={(e) => { e.stopPropagation(); onOpenSwap(meal, mealType, itemIndex); }}
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

      {/* Inline rating picker */}
      {showRatingPicker && !meal.rating && (
        <div
          className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-green-200 dark:border-green-800"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-neutral-500 mr-auto">Як вам смакувало?</span>
          {([1, 2, 3] as const).map((v) => (
            <button
              key={v}
              onClick={() => handleRate(v)}
              disabled={ratingLoading}
              className="text-2xl leading-none active:scale-90 transition-transform disabled:opacity-50 hover:scale-110"
              aria-label={v === 1 ? 'Не сподобалось' : v === 2 ? 'Нормально' : 'Дуже смачно!'}
            >
              {RATING_EMOJIS[v]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
