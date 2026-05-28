'use client';

import { useEffect, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import { BottomSheet } from '@/components/common/BottomSheet';
import { AIMeal } from '@/types/meals';

interface ConsumePortionSheetProps {
  meal: AIMeal | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (consumedWeight: number) => void;
}

const STEP = 10; // grams

function fullWeight(meal: AIMeal): number {
  return Math.round(meal.servingSize * Math.max(1, meal.servings));
}

export function ConsumePortionSheet({ meal, isOpen, onClose, onConfirm }: ConsumePortionSheetProps) {
  const [grams, setGrams] = useState(0);

  useEffect(() => {
    if (meal && isOpen) setGrams(fullWeight(meal));
  }, [meal, isOpen]);

  if (!meal) return null;

  const planned = fullWeight(meal);
  // calories refer to one servingSize portion → kcal per gram = calories / servingSize
  const kcalPerGram = meal.servingSize > 0 ? meal.calories / meal.servingSize : 0;
  const kcal = Math.round(kcalPerGram * grams);
  const protein = Math.round((meal.protein / Math.max(1, meal.servingSize)) * grams);

  const adjust = (delta: number) => setGrams((g) => Math.max(STEP, g + delta));

  const presets = [
    { label: '½', value: Math.round(planned * 0.5) },
    { label: 'Повна', value: planned },
    { label: '1½', value: Math.round(planned * 1.5) },
    { label: '2', value: planned * 2 },
  ];

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Скільки з'їдено?">
      <div className="px-5 py-4 space-y-5">
        {/* Meal */}
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden="true">{meal.emoji}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
              {meal.name}
            </p>
            <p className="text-xs text-neutral-500">
              Повна порція: {planned} г · {Math.round(kcalPerGram * planned)} ккал
            </p>
          </div>
        </div>

        {/* Quick presets */}
        <div className="grid grid-cols-4 gap-2">
          {presets.map((p) => {
            const active = grams === p.value;
            return (
              <button
                key={p.label}
                onClick={() => setGrams(p.value)}
                className={`py-2 rounded-xl text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-main text-white'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Weight stepper */}
        <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-3">
          <button
            onClick={() => adjust(-STEP)}
            disabled={grams <= STEP}
            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-700 shadow flex items-center justify-center disabled:opacity-40"
            aria-label="Зменшити вагу"
          >
            <Minus size={16} />
          </button>
          <div className="text-center">
            <div className="flex items-baseline gap-1 justify-center">
              <input
                type="number"
                inputMode="numeric"
                value={grams}
                onChange={(e) => setGrams(Math.max(0, Number(e.target.value) || 0))}
                onBlur={() => setGrams((g) => Math.max(STEP, g))}
                className="w-20 bg-transparent text-center text-2xl font-bold text-neutral-900 dark:text-neutral-100 focus:outline-none"
                aria-label="Вага в грамах"
              />
              <span className="text-sm font-semibold text-neutral-400">г</span>
            </div>
            <p className="text-xs text-main font-semibold mt-0.5">
              {kcal} ккал · {protein} г Б
            </p>
          </div>
          <button
            onClick={() => adjust(STEP)}
            className="w-10 h-10 rounded-full bg-white dark:bg-neutral-700 shadow flex items-center justify-center"
            aria-label="Збільшити вагу"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Confirm */}
        <button
          onClick={() => onConfirm(Math.max(STEP, grams))}
          className="w-full flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-3.5 rounded-2xl active:scale-[0.98] transition-transform"
        >
          <Check size={18} strokeWidth={3} />
          Відмітити з&apos;їдено
        </button>
      </div>
    </BottomSheet>
  );
}
