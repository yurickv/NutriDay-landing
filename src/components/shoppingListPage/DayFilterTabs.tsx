'use client';

export type DayFilter = 'all' | 'mon-wed' | 'thu-sun';

type PeriodFilter = Exclude<DayFilter, 'all'>;

// Day-of-week indices each period covers (0 = Понеділок … 6 = Неділя). Matching
// by index — not by localized label — avoids the apostrophe/spacing mismatches
// that used to drop "П'ятниця" items out of both halves.
const PERIOD_DAY_INDICES: Record<PeriodFilter, number[]> = {
  'mon-wed': [0, 1, 2],
  'thu-sun': [3, 4, 5, 6],
};

type QuantifiedItem = { quantity: number; quantityByDay: number[]; isCustom: boolean };

/**
 * Quantity of an item needed within the selected period. Sums the per-day
 * breakdown by index, so an ingredient used in both halves is never
 * double-counted and Пн–Ср + Чт–Нд always equals the weekly total. Items with
 * no per-day breakdown (manually added custom items) fall back to their full
 * quantity.
 */
export function periodQuantity(item: Pick<QuantifiedItem, 'quantity' | 'quantityByDay'>, filter: DayFilter): number {
  if (filter === 'all' || !item.quantityByDay || item.quantityByDay.length === 0) {
    return item.quantity;
  }
  const sum = PERIOD_DAY_INDICES[filter].reduce((s, i) => s + (item.quantityByDay[i] ?? 0), 0);
  return Math.round(sum * 10) / 10;
}

/**
 * Whether an item belongs in the selected period. Menu items appear only when
 * actually needed in that period; manual custom items always appear.
 */
export function isVisibleInPeriod(item: QuantifiedItem, filter: DayFilter): boolean {
  if (filter === 'all') return true;
  if (item.isCustom || !item.quantityByDay || item.quantityByDay.length === 0) return true;
  return periodQuantity(item, filter) > 0;
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
