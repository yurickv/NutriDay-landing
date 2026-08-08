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
        <div className="flex items-center gap-1.5 text-xs text-ink/60 dark:text-night-muted">
          <Clock size={13} aria-hidden="true" />
          <span>Підготовка: {meal.prepTimeMinutes} хв</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ink/60 dark:text-night-muted">
          <Clock size={13} aria-hidden="true" />
          <span>Приготування: {meal.cookTimeMinutes} хв</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ink/60 dark:text-night-muted">
          <ChefHat size={13} aria-hidden="true" />
          <span>{DIFFICULTY_LABELS[meal.difficulty]}</span>
        </div>
      </div>

      {meal.isMultiDayPrep && (
        <div className="bg-terracotta-light/20 dark:bg-terracotta/15 border border-terracotta-light dark:border-terracotta/40 rounded-xl p-3">
          <p className="text-xs text-terracotta-dark dark:text-terracotta-light font-semibold">
            🍳 Ця страва готується на {meal.multiDayPrepDays} дні — заощадить ваш час!
          </p>
        </div>
      )}

      {/* Description */}
      <div>
        <h3 className="text-sm font-bold text-ink dark:text-night-ink mb-2">
          Рецепт
        </h3>
        <p className="text-sm text-ink/60 dark:text-night-muted leading-relaxed whitespace-pre-line">
          {meal.description}
        </p>
      </div>
    </div>
  );
}
