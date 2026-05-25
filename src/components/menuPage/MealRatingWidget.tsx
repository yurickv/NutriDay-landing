'use client';

import { useState } from 'react';
import { AIMeal, MealCategory } from '@/types/meals';

interface MealRatingWidgetProps {
  meal: AIMeal;
  dayLabel: string;
  mealType: MealCategory;
  snackIndex?: number;
  onRate: (dayLabel: string, mealType: MealCategory, rating: 1 | 2 | 3, snackIndex?: number) => Promise<void>;
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
  snackIndex,
  onRate,
  onClose,
}: MealRatingWidgetProps) {
  const [loading, setLoading] = useState<number | null>(null);

  const handleRate = async (rating: 1 | 2 | 3) => {
    setLoading(rating);
    try {
      await onRate(dayLabel, mealType, rating, snackIndex);
      if ('vibrate' in navigator) navigator.vibrate([20, 50, 20]);
      onClose();
    } finally {
      setLoading(null);
    }
  };

  if (meal.rating) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-neutral-900 rounded-3xl p-5 shadow-2xl">
        <p className="text-center font-bold text-neutral-800 dark:text-neutral-200 mb-1">
          Як вам смакувало?
        </p>
        <p className="text-center text-xs text-neutral-500 mb-4">
          {meal.name}
        </p>
        <div className="flex justify-center gap-4">
          {RATINGS.map(({ value, emoji, label }) => (
            <button
              key={value}
              onClick={() => handleRate(value)}
              disabled={loading !== null}
              className="flex flex-col items-center gap-1 p-3 rounded-2xl hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-90 transition-all disabled:opacity-60"
              aria-label={label}
            >
              <span className="text-4xl">{emoji}</span>
              <span className="text-[10px] text-neutral-500">{label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-3 text-xs text-neutral-400 py-2"
        >
          Пропустити
        </button>
      </div>
    </div>
  );
}
