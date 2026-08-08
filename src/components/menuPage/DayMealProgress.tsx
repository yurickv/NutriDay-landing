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
        <CheckCircle size={14} className="text-sage-dark dark:text-sage-light" aria-hidden="true" />
      ) : null}
      <span className={`text-xs font-semibold ${isCompleted ? 'text-sage-dark dark:text-sage-light' : 'text-ink/60 dark:text-night-muted'}`}>
        {isCompleted ? 'День виконано!' : `${consumed} з ${total} прийомів ✓`}
      </span>
    </div>
  );
}
