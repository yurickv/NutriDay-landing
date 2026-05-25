'use client';

import { useWaterTracker } from '@/hooks/useWaterTracker';
import { track } from '@/lib/analytics';

const PORTIONS = [200, 250, 350, 500] as const;

export function WaterTracker() {
  const { water, loading, adding, addWater } = useWaterTracker();

  if (loading) {
    return (
      <div className="mx-4 my-3 h-24 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />
    );
  }

  if (!water) return null;

  const { amountMl, goalMl } = water;
  const percent = Math.min(100, Math.round((amountMl / goalMl) * 100));
  const isGoalReached = amountMl >= goalMl;

  const handleAdd = async (ml: number) => {
    await addWater(ml);
    track('water_logged', { amount: ml, totalToday: (water.amountMl ?? 0) + ml });

    // Haptic feedback
    if ('vibrate' in navigator) navigator.vibrate(30);
  };

  return (
    <div className="mx-4 my-3 rounded-2xl bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/40 dark:to-blue-950/30 border border-sky-100 dark:border-sky-900/40 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">💧</span>
          <div>
            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
              Вода
            </p>
            <p className="text-xs text-neutral-500">
              {amountMl} / {goalMl} мл
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isGoalReached
            ? <span className="text-xs font-semibold text-green-600 dark:text-green-400">Ціль ✓</span>
            : <span className="text-xs text-neutral-400">{percent}%</span>
          }
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-sky-100 dark:bg-sky-900/40 rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isGoalReached
              ? 'bg-green-400'
              : percent > 60
              ? 'bg-sky-400'
              : 'bg-sky-300'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Portion buttons */}
      <div className="flex gap-2">
        {PORTIONS.map((ml) => (
          <button
            key={ml}
            onClick={() => { void handleAdd(ml); }}
            disabled={adding}
            className="flex-1 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-neutral-800 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 active:scale-95 transition-transform disabled:opacity-50"
            aria-label={`Додати ${ml} мл води`}
          >
            +{ml}
          </button>
        ))}
      </div>
    </div>
  );
}
