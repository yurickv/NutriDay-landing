'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ShoppingList, ShoppingListItem } from '@/types/shoppingList';
import { ShoppingCategory } from '@/types/meals';
import { CategorySection } from './CategorySection';
import { DayFilterTabs, DayFilter, displayQuantity, isVisibleInPeriod, isEffectivePurchased, computePurchasedUpdate } from './DayFilterTabs';
import { AddCustomItemForm } from './AddCustomItemForm';
import { OfflineIndicator } from './OfflineIndicator';
import { CheckCircle } from 'lucide-react';

const CATEGORY_ORDER: ShoppingCategory[] = [
  'meat', 'fish', 'dairy', 'vegetables', 'fruits', 'grains', 'legumes', 'oils', 'spices', 'other',
];

const OFFLINE_QUEUE_KEY = 'nd_shopping_queue';

interface OfflineQueueEntry {
  itemId: string;
  isPurchased: boolean;
  purchasedPeriods: string[];
  timestamp: number;
}

function loadOfflineQueue(): OfflineQueueEntry[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineQueueEntry[]) : [];
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: OfflineQueueEntry[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

interface ShoppingListViewProps {
  initialList: ShoppingList;
}

export function ShoppingListView({ initialList }: ShoppingListViewProps) {
  const [items, setItems] = useState<ShoppingListItem[]>(initialList.items);
  const [filter, setFilter] = useState<DayFilter>('all');
  const offlineQueueRef = useRef<OfflineQueueEntry[]>([]);
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // Sync pending offline changes on reconnect
  useEffect(() => {
    offlineQueueRef.current = loadOfflineQueue();

    const syncOfflineQueue = async () => {
      const queue = loadOfflineQueue();
      if (queue.length === 0) return;

      const results = await Promise.allSettled(
        queue.map((entry) =>
          fetch('/api/shopping-list', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: entry.itemId, isPurchased: entry.isPurchased, purchasedPeriods: entry.purchasedPeriods }),
          }),
        ),
      );

      // Remove successfully synced entries
      const failedQueue = queue.filter((_, i) => {
        const r = results[i];
        return r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok);
      });
      saveOfflineQueue(failedQueue);
      offlineQueueRef.current = failedQueue;
    };

    window.addEventListener('online', () => void syncOfflineQueue());
    return () => window.removeEventListener('online', () => void syncOfflineQueue());
  }, []);

  const handleToggle = useCallback(async (itemId: string, checked: boolean) => {
    const original = itemsRef.current.find((i) => i.id === itemId);
    if (!original) return;

    const { isPurchased, purchasedPeriods } = computePurchasedUpdate(original, checked, filter);

    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, isPurchased, purchasedPeriods, purchasedAt: isPurchased ? new Date() : null }
          : item,
      ),
    );

    if (!navigator.onLine) {
      const entry: OfflineQueueEntry = { itemId, isPurchased, purchasedPeriods, timestamp: Date.now() };
      const queue = [...offlineQueueRef.current.filter((e) => e.itemId !== itemId), entry];
      offlineQueueRef.current = queue;
      saveOfflineQueue(queue);
      return;
    }

    const res = await fetch('/api/shopping-list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, isPurchased, purchasedPeriods }),
    });

    if (!res.ok) {
      // Revert optimistic update on failure
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId ? { ...item, isPurchased: original.isPurchased, purchasedPeriods: original.purchasedPeriods } : item,
        ),
      );
    }
  }, [filter]);

  const handleAddCustom = useCallback(async (name: string) => {
    const res = await fetch('/api/shopping-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (res.ok) {
      const data = await res.json() as { item: ShoppingListItem };
      setItems((prev) => [...prev, data.item]);
    }
  }, []);

  // Filter items by period, and show each item's quantity + purchased state for
  // that period (summed from per-day breakdown; purchased derived per-period).
  const filteredItems = items
    .filter((item) => isVisibleInPeriod(item, filter))
    .map((item) => ({
      ...item,
      quantity: displayQuantity(item, filter),
      isPurchased: isEffectivePurchased(item, filter),
    }));

  // Group by category
  const grouped = CATEGORY_ORDER.reduce<Record<ShoppingCategory, ShoppingListItem[]>>(
    (acc, cat) => {
      acc[cat] = filteredItems.filter((item) => item.shoppingCategory === cat);
      return acc;
    },
    {} as Record<ShoppingCategory, ShoppingListItem[]>,
  );

  const totalCount = filteredItems.length;
  const purchasedCount = filteredItems.filter((i) => i.isPurchased).length;
  const allDone = totalCount > 0 && purchasedCount === totalCount;

  return (
    <div className="flex flex-col min-h-full">
      <OfflineIndicator />

      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Список покупок
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              {purchasedCount} з {totalCount} куплено
            </p>
          </div>
          {allDone && (
            <div className="flex items-center gap-1.5 text-green-500 text-sm font-semibold">
              <CheckCircle size={18} />
              <span>Готово!</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mt-3 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-300"
              style={{ width: `${(purchasedCount / totalCount) * 100}%` }}
              role="progressbar"
              aria-valuenow={purchasedCount}
              aria-valuemax={totalCount}
              aria-label={`${purchasedCount} з ${totalCount} куплено`}
            />
          </div>
        )}
      </div>

      {/* Day filter */}
      <DayFilterTabs active={filter} onChange={setFilter} />

      {/* Category sections */}
      <div className="flex-1 pb-4">
        {CATEGORY_ORDER.map((cat) => (
          <CategorySection
            key={cat}
            category={cat}
            items={grouped[cat]}
            onToggle={handleToggle}
          />
        ))}

        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-neutral-400 text-sm">
            Немає продуктів для цього фільтра
          </div>
        )}
      </div>

      {/* Add custom item */}
      <AddCustomItemForm onAdd={handleAddCustom} />
    </div>
  );
}
