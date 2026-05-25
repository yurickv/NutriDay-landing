'use client';

interface CalorieProgressBarProps {
  consumed: number;
  goal: number;
}

export function CalorieProgressBar({ consumed, goal }: CalorieProgressBarProps) {
  const pct = Math.min(100, Math.round((consumed / goal) * 100));
  const isOver = consumed > goal;

  const barColor = isOver
    ? 'bg-red-500'
    : pct >= 80
    ? 'bg-yellow-400'
    : 'bg-main';

  return (
    <div className="px-4 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          {isOver ? 'Перевищення!' : 'Калорії'}
        </span>
        <span className={`text-xs font-bold ${isOver ? 'text-red-500' : 'text-neutral-700 dark:text-neutral-300'}`}>
          {consumed} / {goal} ккал
        </span>
      </div>
      <div className="h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={consumed}
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-label={`Спожито ${consumed} з ${goal} ккал`}
        />
      </div>
    </div>
  );
}
