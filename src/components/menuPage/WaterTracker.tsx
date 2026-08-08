'use client';

import { useWaterTracker } from '@/hooks/useWaterTracker';
import { track } from '@/lib/analytics';

const PORTIONS = [200, 250, 350, 500] as const;

export function WaterTracker({ date }: { date?: string }) {
  const { water, loading, adding, addWater } = useWaterTracker(date);

  if (loading) {
    return (
      <div className="h-24 bg-ink/10 dark:bg-night-ink/10 rounded-2xl animate-pulse" />
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
    <div className="rounded-2xl bg-card dark:bg-night-card shadow-soft p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">💧</span>
          <div>
            <p className="text-sm font-bold text-ink dark:text-night-ink">
              Вода
            </p>
            <p className="text-xs text-ink/60 dark:text-night-muted">
              {amountMl} / {goalMl} мл
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isGoalReached
            ? <span className="text-xs font-semibold text-sage-dark dark:text-sage-light">Ціль ✓</span>
            : <span className="text-xs text-ink/60 dark:text-night-muted">{percent}%</span>
          }
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-sage-light/40 dark:bg-night rounded-full overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            percent >= 100 ? 'bg-sage-dark' : 'bg-sage'
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
            className="flex-1 py-2 text-xs font-semibold rounded-xl bg-card dark:bg-night-card border border-sage-light dark:border-sage/40 text-sage-dark dark:text-sage-light active:scale-95 transition-all disabled:opacity-50"
            aria-label={`Додати ${ml} мл води`}
          >
            +{ml}
          </button>
        ))}
      </div>
    </div>
  );
}
