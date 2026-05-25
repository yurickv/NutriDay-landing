'use client';

import { Clock, ChefHat } from 'lucide-react';
import { AIMeal } from '@/types/meals';

const DIFFICULTY_LABELS: Record<AIMeal['difficulty'], string> = {
  easy: 'Легко',
  medium: 'Середньо',
  hard: 'Складно',
};

interface RecipeTabProps {
  meal: AIMeal;
}

export function RecipeTab({ meal }: RecipeTabProps) {
  return (
    <div className="px-5 py-4 space-y-4">
      {/* Meta */}
      <div className="flex gap-3">
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Clock size={13} aria-hidden="true" />
          <span>Підготовка: {meal.prepTimeMinutes} хв</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Clock size={13} aria-hidden="true" />
          <span>Приготування: {meal.cookTimeMinutes} хв</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500">
          <ChefHat size={13} aria-hidden="true" />
          <span>{DIFFICULTY_LABELS[meal.difficulty]}</span>
        </div>
      </div>

      {meal.isMultiDayPrep && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
          <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
            🍳 Ця страва готується на {meal.multiDayPrepDays} дні — заощадить ваш час!
          </p>
        </div>
      )}

      {/* Description */}
      <div>
        <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-2">
          Рецепт
        </h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed whitespace-pre-line">
          {meal.description}
        </p>
      </div>
    </div>
  );
}
