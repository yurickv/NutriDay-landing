'use client';

import { MealCardSkeleton } from '@/components/common/SkeletonCard';

export function GenerateMenuLoader() {
  return (
    <div className="flex flex-col gap-4 px-4 py-6 animate-pulse">
      <div className="text-center space-y-2 mb-2">
        <div className="text-4xl">🤖</div>
        <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
          AI складає ваше персональне меню…
        </p>
        <p className="text-xs text-neutral-400">Зазвичай займає 15–30 секунд</p>
      </div>

      {/* Fake day tabs */}
      <div className="flex gap-2 overflow-hidden">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((d) => (
          <div
            key={d}
            className="flex-shrink-0 w-10 h-8 bg-neutral-200 dark:bg-neutral-800 rounded-xl"
          />
        ))}
      </div>

      {/* Skeleton meal cards */}
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <MealCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
