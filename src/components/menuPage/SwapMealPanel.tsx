'use client';

import { useState, useEffect } from 'react';
import { BottomSheet } from '@/components/common/BottomSheet';
import { AIMeal, MealCategory } from '@/types/meals';
import { RefreshCw } from 'lucide-react';

interface SwapMealPanelProps {
  meal: AIMeal | null;
  mealType: MealCategory | null;
  itemIndex?: number;
  dayLabel: string;
  isOpen: boolean;
  onClose: () => void;
  onSwap: (dayLabel: string, mealType: MealCategory, alternativeIndex: number, itemIndex?: number) => Promise<void>;
}

export function SwapMealPanel({
  meal,
  mealType,
  itemIndex,
  dayLabel,
  isOpen,
  onClose,
  onSwap,
}: SwapMealPanelProps) {
  const [loading, setLoading] = useState<number | null>(null);
  const [alternatives, setAlternatives] = useState<AIMeal[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Alternatives are generated on demand (no longer bundled with the weekly menu).
  useEffect(() => {
    if (!isOpen || !meal || !mealType) return;

    let cancelled = false;
    setAlternatives([]);
    setFetchError(null);
    setFetching(true);

    const params = new URLSearchParams({ dayLabel, mealType });
    params.set('itemIndex', String(itemIndex ?? 0));

    fetch(`/api/menu/meal/alternatives?${params.toString()}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('failed');
        const data = (await res.json()) as { alternatives: AIMeal[] };
        if (!cancelled) setAlternatives(data.alternatives ?? []);
      })
      .catch(() => {
        if (!cancelled) setFetchError('Не вдалося підібрати альтернативи. Спробуйте ще раз.');
      })
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, meal, mealType, itemIndex, dayLabel]);

  if (!meal || !mealType) return null;

  const handleSwap = async (idx: number) => {
    setLoading(idx);
    try {
      await onSwap(dayLabel, mealType, idx, itemIndex);
      onClose();
    } finally {
      setLoading(null);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Замінити страву">
      <div className="px-5 pb-6 space-y-3 pt-3">
        <p className="text-xs text-ink/60 dark:text-night-muted">
          Замінюємо: <span className="font-semibold text-ink dark:text-night-ink">{meal.name}</span>
        </p>

        {fetching ? (
          <div className="flex flex-col items-center gap-2 py-8 text-ink/60 dark:text-night-muted">
            <RefreshCw size={22} className="animate-spin" />
            <p className="text-sm">Підбираємо альтернативи…</p>
          </div>
        ) : fetchError ? (
          <p className="text-sm text-danger dark:text-danger-dark text-center py-6">{fetchError}</p>
        ) : alternatives.length === 0 ? (
          <p className="text-sm text-ink/60 dark:text-night-muted text-center py-6">
            Немає доступних альтернатив
          </p>
        ) : (
          alternatives.map((alt, idx) => (
            <button
              key={idx}
              onClick={() => handleSwap(idx)}
              disabled={loading !== null}
              className="w-full flex items-center gap-3 p-4 rounded-2xl border border-transparent bg-cream dark:bg-night text-left hover:border-sage transition-colors disabled:opacity-60"
            >
              <span className="text-3xl flex-shrink-0" aria-hidden="true">{alt.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink dark:text-night-ink leading-snug">{alt.name}</p>
                <p className="text-xs text-ink/60 dark:text-night-muted mt-0.5">{alt.calories} ккал · {alt.protein}г Б · {alt.fat}г Ж · {alt.carbs}г В</p>
              </div>
              {loading === idx ? (
                <RefreshCw size={16} className="animate-spin text-ink/40 dark:text-night-muted flex-shrink-0" />
              ) : null}
            </button>
          ))
        )}
      </div>
    </BottomSheet>
  );
}
