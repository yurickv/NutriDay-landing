'use client';

import { useState, useRef } from 'react';
import { Check, RefreshCw, Smile } from 'lucide-react';
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
const RATING_LABELS: Record<1 | 2 | 3, string> = { 1: 'Не сподобалось', 2: 'Нормально', 3: 'Смачно!' };

const SECTION_COLORS: Record<MealCategory, string> = {
  breakfast: '#3B82F6',
  lunch: '#F97316',
  dinner: '#8B5CF6',
  snack: '#10B981',
};

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
  const [ratingLoading, setRatingLoading] = useState(false);
  const [showRatingPicker, setShowRatingPicker] = useState(false);
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
      setLoading(true);
      try {
        await onConsume(dayLabel, mealType, itemIndex, false);
        if ('vibrate' in navigator) navigator.vibrate(30);
      } finally {
        setLoading(false);
      }
      return;
    }
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

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > 70) {
      void onConsume(dayLabel, mealType, itemIndex, true);
    } else if (delta < -70) {
      onOpenSwap(meal, mealType, itemIndex);
    }
    touchStartX.current = null;
  };

  const totalKcal = meal.calories * meal.servings;
  const sectionColor = SECTION_COLORS[mealType];

  return (
    <>
    <div
      role="article"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => onOpenDetail(meal)}
      className={`rounded-xl border px-3 py-[11px] flex items-center gap-2.5 cursor-pointer active:scale-[0.98] transition-all select-none ${
        meal.isConsumed
          ? 'bg-green-50 border-green-200 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:bg-green-900/20 dark:border-green-900 dark:shadow-[0_2px_10px_rgba(0,0,0,0.5)]'
          : 'bg-white border-neutral-200 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:bg-neutral-900 dark:border-neutral-700 dark:shadow-[0_2px_10px_rgba(0,0,0,0.5)]'
      }`}
      aria-label={`${MEAL_LABELS[mealType]}: ${meal.name}`}
    >
      {/* Emoji */}
      <span className="text-2xl w-8 text-center flex-shrink-0 leading-none mt-0.5" aria-hidden="true">
        {meal.emoji}
      </span>

      {/* Content body */}
      <div className="flex-1 min-w-0">
        {/* Name */}
        <p className={`text-[13px] font-semibold truncate ${
          meal.isConsumed
            ? 'line-through text-neutral-400 dark:text-neutral-600'
            : 'text-neutral-900 dark:text-neutral-100'
        }`}>
          {meal.name}
        </p>

        {/* Kcal — big number */}
        <div className="flex items-baseline gap-1 mt-0.5">
          <span
            className={`font-bold leading-tight ${totalKcal < 200 ? 'text-sm' : 'text-[17px]'}`}
            style={{ color: meal.isConsumed ? undefined : sectionColor }}
          >
            {totalKcal}
          </span>
          <span className="text-[11px] text-neutral-400 dark:text-neutral-600">ккал</span>
          {meal.servingSize > 0 && (
            <span className="text-[11px] text-neutral-300 dark:text-neutral-700 ml-1">
              · {meal.servingSize * meal.servings} г
            </span>
          )}
        </div>

        {/* Macros + prep time row */}
        <div className="flex gap-2 mt-0.5 text-[11px] text-neutral-400 dark:text-neutral-500">
          {meal.protein > 0 && <span>{meal.protein} г Б</span>}
          {(meal.prepTimeMinutes + meal.cookTimeMinutes) > 0 && (
            <span>⏱ {meal.prepTimeMinutes + meal.cookTimeMinutes} хв</span>
          )}
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          {meal.isSwapped && (
            <span className="inline-block text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">
              замінено
            </span>
          )}
          {meal.isConsumed && (
            <span
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border"
              style={{
                color: 'var(--color-eaten-text)',
                background: 'var(--color-eaten-bg)',
                borderColor: 'var(--color-eaten-border)',
              }}
            >
              ✓ з&apos;їдено{meal.consumedWeight != null ? ` ${meal.consumedWeight} г` : ''}
            </span>
          )}
        </div>

      </div>

      {/* Action buttons */}
      <div
        className="flex flex-row items-center gap-1.5 flex-shrink-0 self-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rating: emoji if rated, Smile toggle if consumed+unrated */}
        {meal.isConsumed && (
          meal.rating ? (
            <span
              className="w-7 h-7 flex items-center justify-center text-base leading-none"
              aria-label={`Оцінка: ${RATING_EMOJIS[meal.rating as 1 | 2 | 3]}`}
            >
              {RATING_EMOJIS[meal.rating as 1 | 2 | 3]}
            </span>
          ) : (
            <button
              onClick={() => setShowRatingPicker((v) => !v)}
              className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors ${
                showRatingPicker
                  ? 'text-orange-500 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800'
                  : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-400'
              }`}
              aria-label="Оцінити страву"
              aria-expanded={showRatingPicker}
            >
              <Smile size={13} />
            </button>
          )
        )}

        <button
          onClick={() => onOpenSwap(meal, mealType, itemIndex)}
          className="w-7 h-7 rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
          aria-label="Замінити страву"
        >
          <RefreshCw size={13} className="text-neutral-400" />
        </button>

        <button
          onClick={handleConsume}
          disabled={loading}
          className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors disabled:opacity-50 ${
            meal.isConsumed
              ? 'bg-green-500 border-green-500'
              : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700'
          }`}
          aria-label={meal.isConsumed ? 'Скасувати' : "Позначити як з'їдено"}
          aria-pressed={meal.isConsumed}
        >
          <Check size={13} strokeWidth={3} className={meal.isConsumed ? 'text-white' : 'text-neutral-400'} />
        </button>
      </div>
    </div>

    {/* Rating accordion — opens below card on Smile click */}
    {showRatingPicker && !meal.rating && (
      <div
        className="flex items-center gap-3 mt-1 px-3 py-2.5 rounded-xl border"
        style={{
          background: 'var(--color-rating-bg)',
          borderColor: 'var(--color-rating-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-neutral-500 mr-auto">Як вам смакувало?</span>
        {([1, 2, 3] as const).map((v) => (
          <button
            key={v}
            onClick={() => void handleRate(v)}
            disabled={ratingLoading}
            className="text-2xl leading-none active:scale-90 transition-transform disabled:opacity-50 hover:scale-110"
            aria-label={RATING_LABELS[v]}
          >
            {RATING_EMOJIS[v]}
          </button>
        ))}
      </div>
    )}
    </>
  );
}
