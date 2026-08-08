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

  return (
    <>
    <div
      role="article"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={() => onOpenDetail(meal)}
      className={`rounded-xl px-3 py-[11px] flex items-center gap-2.5 cursor-pointer active:scale-[0.98] transition-all select-none shadow-soft ${
        meal.isConsumed
          ? 'bg-sage-light/30 dark:bg-sage/15 border border-sage-light dark:border-sage/40'
          : 'bg-card dark:bg-night-card'
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
            ? 'line-through text-ink/60 dark:text-night-muted'
            : 'text-ink dark:text-night-ink'
        }`}>
          {meal.name}
        </p>

        {/* Kcal — big number */}
        <div className="flex items-baseline gap-1 mt-0.5">
          <span
            className={`font-semibold leading-tight text-ink dark:text-night-ink ${totalKcal < 200 ? 'text-sm' : 'text-[17px]'}`}
          >
            {totalKcal}
          </span>
          <span className="text-[11px] text-ink/60 dark:text-night-muted">ккал</span>
          {meal.servingSize > 0 && (
            <span className="text-[11px] text-ink/40 dark:text-night-muted ml-1">
              · {meal.servingSize * meal.servings} г
            </span>
          )}
        </div>

        {/* Macros + prep time row */}
        <div className="flex gap-2 mt-0.5 text-[11px] text-ink/60 dark:text-night-muted">
          {meal.protein > 0 && <span>{meal.protein} г Б</span>}
          {(meal.prepTimeMinutes + meal.cookTimeMinutes) > 0 && (
            <span>⏱ {meal.prepTimeMinutes + meal.cookTimeMinutes} хв</span>
          )}
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap mt-1">
          {meal.isSwapped && (
            <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-terracotta-light/20 dark:bg-terracotta/15 border border-terracotta-light dark:border-terracotta/40 text-terracotta-dark dark:text-terracotta-light">
              замінено
            </span>
          )}
          {meal.isConsumed && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-sage-light dark:border-sage/40 bg-sage-light/40 dark:bg-sage/20 text-sage-dark dark:text-sage-light">
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
                  ? 'text-terracotta bg-terracotta-light/30 border-terracotta-light dark:bg-terracotta/15 dark:border-terracotta/40'
                  : 'border-ink/10 dark:border-night-ink/10 bg-cream dark:bg-night hover:bg-sage-light/40 dark:hover:bg-sage/20 text-ink/40 dark:text-night-muted'
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
          className="w-7 h-7 rounded-full border border-ink/10 dark:border-night-ink/10 bg-cream dark:bg-night flex items-center justify-center hover:bg-sage-light/40 dark:hover:bg-sage/20 transition-colors"
          aria-label="Замінити страву"
        >
          <RefreshCw size={13} className="text-ink/40 dark:text-night-muted" />
        </button>

        <button
          onClick={handleConsume}
          disabled={loading}
          className={`w-7 h-7 rounded-full border flex items-center justify-center transition-colors disabled:opacity-50 ${
            meal.isConsumed
              ? 'bg-sage border-sage'
              : 'border-ink/10 dark:border-night-ink/10 bg-cream dark:bg-night hover:bg-sage-light/40 dark:hover:bg-sage/20'
          }`}
          aria-label={meal.isConsumed ? 'Скасувати' : "Позначити як з'їдено"}
          aria-pressed={meal.isConsumed}
        >
          <Check size={13} strokeWidth={3} className={meal.isConsumed ? 'text-card' : 'text-ink/40 dark:text-night-muted'} />
        </button>
      </div>
    </div>

    {/* Rating accordion — opens below card on Smile click */}
    {showRatingPicker && !meal.rating && (
      <div
        className="flex items-center gap-3 mt-1 px-3 py-2.5 rounded-xl border bg-terracotta-light/15 dark:bg-terracotta/10 border-terracotta-light/60 dark:border-terracotta/30"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs text-ink/60 dark:text-night-muted mr-auto">Як вам смакувало?</span>
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
