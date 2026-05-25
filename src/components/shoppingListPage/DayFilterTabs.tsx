'use client';

export type DayFilter = 'all' | 'mon-wed' | 'thu-sun';

const MON_WED_DAYS = ['Понеділок', 'Вівторок', 'Середа'];
const THU_SUN_DAYS = ['Четвер', 'П\'ятниця', 'Субота', 'Неділя'];

export function matchesDayFilter(forDays: string[], filter: DayFilter): boolean {
  if (filter === 'all') return true;
  const allowed = filter === 'mon-wed' ? MON_WED_DAYS : THU_SUN_DAYS;
  // Show item if it's needed on at least one day in the filter
  // Also show items with no specific day (custom items or items spanning all week)
  if (forDays.length === 0) return true;
  return forDays.some((d) => allowed.includes(d));
}

interface DayFilterTabsProps {
  active: DayFilter;
  onChange: (filter: DayFilter) => void;
}

const TABS: { value: DayFilter; label: string }[] = [
  { value: 'all', label: 'Весь тиждень' },
  { value: 'mon-wed', label: 'Пн–Ср' },
  { value: 'thu-sun', label: 'Чт–Нд' },
];

export function DayFilterTabs({ active, onChange }: DayFilterTabsProps) {
  return (
    <div className="flex gap-2 px-4 py-3">
      {TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-colors ${
            active === tab.value
              ? 'bg-orange-500 text-white shadow-sm'
              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
