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
type PurchasableItem = QuantifiedItem & { isPurchased: boolean; purchasedPeriods?: string[] };

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
 * Whether the item is purchased for the active filter. In period views the check
 * uses `purchasedPeriods`; in the 'all' view (or for custom items) it falls back
 * to the global `isPurchased`. Items that predate per-period tracking (no
 * `purchasedPeriods`) also fall back to `isPurchased` for backward compat.
 */
export function isEffectivePurchased(item: PurchasableItem, filter: DayFilter): boolean {
  if (filter === 'all' || item.isCustom || !item.quantityByDay?.length) {
    return item.isPurchased;
  }
  if (!item.purchasedPeriods || item.purchasedPeriods.length === 0) {
    return item.isPurchased; // backward compat for legacy items
  }
  return item.purchasedPeriods.includes(filter);
}

/**
 * Quantity to display for an item. In period views: quantity for that period.
 * In 'all' view: total minus already-purchased period quantities, so the number
 * shrinks as you tick off each half of the week. Custom items always show full
 * quantity (no per-period breakdown to subtract).
 */
export function displayQuantity(item: PurchasableItem, filter: DayFilter): number {
  if (filter !== 'all') return periodQuantity(item, filter);
  if (item.isCustom || !item.quantityByDay?.length) return item.quantity;

  const purchasedQty = (['mon-wed', 'thu-sun'] as PeriodFilter[])
    .filter((p) => (item.purchasedPeriods ?? []).includes(p))
    .reduce((s, p) => s + periodQuantity(item, p), 0);

  return Math.max(0, Math.round((item.quantity - purchasedQty) * 10) / 10);
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

/**
 * Computes the new `isPurchased` + `purchasedPeriods` when the user toggles an
 * item in `filter` view. Custom items / 'all' view toggle the global flag;
 * period views toggle only that period and derive the global flag from whether
 * all active periods are now purchased.
 */
export function computePurchasedUpdate(
  item: PurchasableItem,
  checked: boolean,
  filter: DayFilter,
): { isPurchased: boolean; purchasedPeriods: string[] } {
  if (filter === 'all' || item.isCustom || !item.quantityByDay?.length) {
    return { isPurchased: checked, purchasedPeriods: checked ? ['mon-wed', 'thu-sun'] : [] };
  }

  const current = item.purchasedPeriods ?? [];
  const newPeriods = checked
    ? [...new Set([...current, filter])]
    : current.filter((p) => p !== filter);

  const hasMonWed = periodQuantity(item, 'mon-wed') > 0;
  const hasThuSun = periodQuantity(item, 'thu-sun') > 0;
  const allDone =
    (!hasMonWed || newPeriods.includes('mon-wed')) &&
    (!hasThuSun || newPeriods.includes('thu-sun'));

  return { isPurchased: allDone, purchasedPeriods: newPeriods };
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
