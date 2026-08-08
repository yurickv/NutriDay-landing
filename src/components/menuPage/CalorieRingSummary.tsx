'use client';

const SAGE = 'var(--color-sage)';
const TERRACOTTA = 'var(--color-terracotta)';

function formatKcal(n: number) {
  return n.toLocaleString('uk-UA');
}

function MacroStat({ label, consumed, goal }: {
  label: string;
  consumed: number;
  goal: number;
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((consumed / goal) * 100)) : 0;
  const isOver = consumed > goal;
  return (
    <div className="flex-1 flex flex-col items-center gap-1">
      <span className="text-xs font-semibold text-ink dark:text-night-ink">
        {label}
      </span>
      <div className="w-full h-1.5 rounded-full overflow-hidden bg-sage-light dark:bg-night">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: isOver ? TERRACOTTA : SAGE }}
          role="progressbar"
          aria-valuenow={consumed}
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-label={`${label}: ${consumed} з ${goal} г`}
        />
      </div>
      <span className="text-xs text-ink/60 dark:text-night-muted">
        <span className="font-bold text-ink dark:text-night-ink">{consumed}</span>
        {' / '}{goal} г
      </span>
    </div>
  );
}

export function CalorieRingSummary({ consumed, goalCalories, goalMacros }: {
  consumed: { calories: number; protein: number; fat: number; carbs: number };
  goalCalories: number;
  goalMacros: { protein: number; fat: number; carbs: number };
}) {
  const isOver = consumed.calories > goalCalories;
  const ratio = goalCalories > 0 ? Math.min(1, consumed.calories / goalCalories) : 0;

  const size = 190;
  const stroke = 13;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="mx-4 mt-4 px-4 py-5 rounded-3xl shadow-soft bg-card dark:bg-night-card">
      <div className="flex justify-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg
            width={size}
            height={size}
            className="-rotate-90"
            role="progressbar"
            aria-valuenow={consumed.calories}
            aria-valuemin={0}
            aria-valuemax={goalCalories}
            aria-label={`Спожито ${consumed.calories} з ${goalCalories} ккал`}
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              className="stroke-sage-light dark:stroke-night"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              stroke={isOver ? TERRACOTTA : SAGE}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ratio)}
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-heading font-bold tracking-tight text-ink dark:text-night-ink">
              {formatKcal(consumed.calories)}
            </span>
            <span className="text-sm text-ink/60 dark:text-night-muted">
              з {formatKcal(goalCalories)} ккал
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mt-4">
        <MacroStat label="Вуглеводи" consumed={consumed.carbs} goal={goalMacros.carbs} />
        <MacroStat label="Жири" consumed={consumed.fat} goal={goalMacros.fat} />
        <MacroStat label="Білки" consumed={consumed.protein} goal={goalMacros.protein} />
      </div>
    </div>
  );
}
