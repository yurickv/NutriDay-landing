'use client';

/**
 * Brand book tokens (slide 5 + dark theme slide 8).
 * Dark mode swaps only surfaces (neutral-900/800) and text (neutral-100/400);
 * sage & terracotta accents stay the same in both themes.
 */
const SAGE = '#7a8a5e';
const TERRACOTTA = '#c67139';

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
      <span className="text-xs font-semibold text-[#201e1d] dark:text-[#f9f4ed]">
        {label}
      </span>
      <div className="w-full h-1.5 rounded-full overflow-hidden bg-[#ccdbb2] dark:bg-[#2e2b25]">
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
      <span className="text-xs text-[#645c50] dark:text-[#a19786]">
        <span className="font-bold text-[#201e1d] dark:text-[#f9f4ed]">{consumed}</span>
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
    <div className="mx-4 mt-4 px-4 py-5 rounded-3xl shadow-[0_4px_20px_rgba(32,30,29,0.06)] bg-[#f9f4ed] dark:bg-[#474238]">
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
              className="stroke-[#ccdbb2] dark:stroke-[#2e2b25]"
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
            <span className="text-4xl font-extrabold tracking-tight text-[#201e1d] dark:text-[#f9f4ed]">
              {formatKcal(consumed.calories)}
            </span>
            <span className="text-sm text-[#645c50] dark:text-[#a19786]">
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
