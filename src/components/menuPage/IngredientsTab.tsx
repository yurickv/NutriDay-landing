'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { AIMeal } from '@/types/meals';

interface IngredientsTabProps {
  meal: AIMeal;
}

export function IngredientsTab({ meal }: IngredientsTabProps) {
  const [servings, setServings] = useState(meal.servings);

  const adjust = (delta: number) => {
    setServings((prev) => Math.max(1, Math.min(10, prev + delta)));
  };

  return (
    <div className="px-5 py-4 space-y-4">
      {/* Servings selector */}
      <div className="flex items-center justify-between bg-cream dark:bg-night rounded-2xl p-3">
        <span className="text-sm font-semibold text-ink dark:text-night-ink">
          Порцій
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => adjust(-1)}
            disabled={servings <= 1}
            className="w-8 h-8 rounded-full bg-card dark:bg-night-card shadow-soft flex items-center justify-center disabled:opacity-40"
            aria-label="Зменшити порції"
          >
            <Minus size={14} />
          </button>
          <span className="text-base font-bold w-6 text-center">{servings}</span>
          <button
            onClick={() => adjust(1)}
            disabled={servings >= 10}
            className="w-8 h-8 rounded-full bg-card dark:bg-night-card shadow-soft flex items-center justify-center disabled:opacity-40"
            aria-label="Збільшити порції"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Total dish weight */}
      {meal.servingSize > 0 && (
        <p className="text-xs text-ink/60 dark:text-night-muted text-center -mt-1">
          Вага страви:{' '}
          <span className="font-semibold text-ink dark:text-night-ink">
            {Math.round(meal.servingSize * servings)} г
          </span>
          {servings > 1 && ` (${meal.servingSize} г × ${servings})`}
        </p>
      )}

      {/* Ingredients list */}
      <ul className="space-y-2">
        {meal.ingredients.map((ing, i) => (
          <li
            key={i}
            className="flex items-center justify-between py-2 border-b border-ink/10 dark:border-night-ink/10 last:border-0"
          >
            <span className="text-sm text-ink/60 dark:text-night-muted capitalize">
              {ing.name}
            </span>
            <span className="text-sm font-semibold text-ink dark:text-night-ink">
              {Math.round(ing.quantity * servings * 10) / 10} {ing.unit}
            </span>
          </li>
        ))}
      </ul>

      {/* Nutrition for selected servings */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Ккал', val: Math.round(meal.calories * servings) },
          { label: 'Білки', val: `${Math.round(meal.protein * servings)}г` },
          { label: 'Жири', val: `${Math.round(meal.fat * servings)}г` },
          { label: 'Вуглев.', val: `${Math.round(meal.carbs * servings)}г` },
        ].map(({ label, val }) => (
          <div key={label} className="text-center bg-cream dark:bg-night rounded-xl p-2">
            <div className="text-xs text-ink/60 dark:text-night-muted mb-0.5">{label}</div>
            <div className="text-sm font-bold text-ink dark:text-night-ink">{val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
