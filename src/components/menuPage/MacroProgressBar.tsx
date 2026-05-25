'use client';

interface MacroProgressBarProps {
  consumed: { protein: number; fat: number; carbs: number };
  goal: { protein: number; fat: number; carbs: number };
}

function MacroBar({ label, consumed, goal, color }: {
  label: string;
  consumed: number;
  goal: number;
  color: string;
}) {
  const pct = Math.min(100, Math.round((consumed / goal) * 100));
  return (
    <div className="flex-1">
      <div className="flex justify-between text-[10px] mb-0.5 font-semibold text-neutral-500">
        <span>{label}</span>
        <span>{consumed}г</span>
      </div>
      <div className="h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function MacroProgressBar({ consumed, goal }: MacroProgressBarProps) {
  return (
    <div className="px-4 pb-3 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800">
      <div className="flex gap-3">
        <MacroBar label="Білки" consumed={consumed.protein} goal={goal.protein} color="bg-blue-400" />
        <MacroBar label="Жири" consumed={consumed.fat} goal={goal.fat} color="bg-yellow-400" />
        <MacroBar label="Вуглев." consumed={consumed.carbs} goal={goal.carbs} color="bg-orange-400" />
      </div>
    </div>
  );
}
