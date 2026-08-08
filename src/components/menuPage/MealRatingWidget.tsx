'use client';

import { useState } from 'react';
import { AIMeal, MealCategory } from '@/types/meals';

interface MealRatingWidgetProps {
  meal: AIMeal;
  dayLabel: string;
  mealType: MealCategory;
  itemIndex?: number;
  onRate: (dayLabel: string, mealType: MealCategory, rating: 1 | 2 | 3, itemIndex?: number) => Promise<void>;
  onClose: () => void;
}

const RATINGS: Array<{ value: 1 | 2 | 3; emoji: string; label: string }> = [
  { value: 1, emoji: '👎', label: 'Не сподобалось' },
  { value: 2, emoji: '😐', label: 'Нормально' },
  { value: 3, emoji: '😍', label: 'Дуже смачно!' },
];

export function MealRatingWidget({
  meal,
  dayLabel,
  mealType,
  itemIndex,
  onRate,
  onClose,
}: MealRatingWidgetProps) {
  const [loading, setLoading] = useState<number | null>(null);

  const handleRate = async (rating: 1 | 2 | 3) => {
    setLoading(rating);
    try {
      await onRate(dayLabel, mealType, rating, itemIndex);
      if ('vibrate' in navigator) navigator.vibrate([20, 50, 20]);
      onClose();
    } finally {
      setLoading(null);
    }
  };

  if (meal.rating) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card dark:bg-night-card rounded-3xl p-5 shadow-2xl">
        <p className="text-center font-heading font-semibold text-ink dark:text-night-ink mb-1">
          Як вам смакувало?
        </p>
        <p className="text-center text-xs text-ink/60 dark:text-night-muted mb-4">
          {meal.name}
        </p>
        <div className="flex justify-center gap-4">
          {RATINGS.map(({ value, emoji, label }) => (
            <button
              key={value}
              onClick={() => handleRate(value)}
              disabled={loading !== null}
              className="flex flex-col items-center gap-1 p-3 rounded-2xl hover:bg-cream dark:hover:bg-night active:scale-90 transition-all disabled:opacity-60"
              aria-label={label}
            >
              <span className="text-4xl">{emoji}</span>
              <span className="text-[10px] text-ink/60 dark:text-night-muted">{label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-3 text-xs text-ink/60 dark:text-night-muted py-2"
        >
          Пропустити
        </button>
      </div>
    </div>
  );
}
