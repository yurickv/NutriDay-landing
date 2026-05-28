'use client';

import { useState } from 'react';
import { BottomSheet } from '@/components/common/BottomSheet';
import { IngredientsTab } from './IngredientsTab';
import { RecipeTab } from './RecipeTab';
import { AIMeal } from '@/types/meals';

interface MealDetailSheetProps {
  meal: AIMeal | null;
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'recipe' | 'ingredients';

export function MealDetailSheet({ meal, isOpen, onClose }: MealDetailSheetProps) {
  const [tab, setTab] = useState<Tab>('recipe');

  if (!meal) return null;

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose}>
      {/* Meal header */}
      <div className="px-5 pt-3 pb-4 border-b border-neutral-100 dark:border-neutral-800">
        <div className="flex items-start gap-3">
          <span className="text-4xl" aria-hidden="true">{meal.emoji}</span>
          <div className="flex-1">
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 leading-snug">
              {meal.name}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {meal.calories} ккал{meal.servingSize > 0 ? ` · ${meal.servingSize} г` : ''} · {meal.protein}г Б · {meal.fat}г Ж · {meal.carbs}г В
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-xs text-neutral-400 mt-1"
            aria-label="Закрити"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-100 dark:border-neutral-800">
        {(['recipe', 'ingredients'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              tab === t
                ? 'text-main border-b-2 border-main'
                : 'text-neutral-400 dark:text-neutral-500'
            }`}
          >
            {t === 'recipe' ? 'Рецепт' : 'Інгредієнти'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'recipe' ? (
        <RecipeTab meal={meal} />
      ) : (
        <IngredientsTab meal={meal} />
      )}
    </BottomSheet>
  );
}
