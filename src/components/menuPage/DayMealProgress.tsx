'use client';

import { CheckCircle } from 'lucide-react';

interface DayMealProgressProps {
  consumed: number;
  total: number;
  isCompleted: boolean;
}

export function DayMealProgress({ consumed, total, isCompleted }: DayMealProgressProps) {
  return (
    <div className="flex items-center gap-1.5">
      {isCompleted ? (
        <CheckCircle size={14} className="text-green-500" aria-hidden="true" />
      ) : null}
      <span className={`text-xs font-semibold ${isCompleted ? 'text-green-500' : 'text-neutral-500 dark:text-neutral-400'}`}>
        {isCompleted ? 'День виконано!' : `${consumed} з ${total} прийомів ✓`}
      </span>
    </div>
  );
}
