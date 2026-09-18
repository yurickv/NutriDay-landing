'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { ShoppingList, ShoppingListItem } from '@/types/shoppingList';
import { ShoppingCategory } from '@/types/meals';
import { CategorySection } from './CategorySection';
import { DayFilterTabs, DayFilter, displayQuantity, isVisibleInPeriod, isEffectivePurchased, computePurchasedUpdate } from './DayFilterTabs';
import { AddCustomItemForm } from './AddCustomItemForm';
import { OfflineIndicator } from './OfflineIndicator';
import { SilpoOrderButton } from './SilpoOrderButton';
import { SilpoOrderSheet, OrderItem, AddedProduct } from './SilpoOrderSheet';
import { SilpoOrderBanner } from './SilpoOrderBanner';
import { useSilpoConnection } from '@/hooks/useSilpoConnection';
import { ToastContainer, ToastData } from '@/components/common/Toast';
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
  const silpo = useSilpoConnection();
  const [silpoOpen, setSilpoOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const addToast = useCallback((message: string, emoji?: string, type: ToastData['type'] = 'success') => {
    setToasts((prev) => [...prev, { id: crypto.randomUUID(), message, emoji, type }]);
  }, []);
  const removeToast = useCallback((id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  useEffect(() => {
    if (silpo.flash === 'connected') addToast('Сільпо підключено', '🛒');
    if (silpo.flash === 'error') addToast('Не вдалося підключити Сільпо', '😔', 'error');
  }, [silpo.flash, addToast]);

  // Mirror the server-side «у кошику Сільпо» tag locally right after a successful add.
  const handleSilpoAdded = useCallback((added: AddedProduct[]) => {
    const byItem = new Map(added.map((a) => [a.itemId, a]));
    const now = new Date();
    setItems((prev) =>
      prev.map((item) => {
        const a = byItem.get(item.id);
        return a
          ? { ...item, silpo: { productId: a.productId, productName: a.productName, quantity: a.quantity, addedAt: now } }
          : item;
      }),
    );
    addToast(`${added.length} товарів додано в кошик Сільпо`, '🛒');
  }, [addToast]);

  // Banner «Схоже, ви оформили замовлення»: tick confirmed items for the whole week.
  const handleOrderConfirmed = useCallback((itemIds: string[]) => {
    const ids = new Set(itemIds);
    setItems((prev) =>
      prev.map((item) =>
        ids.has(item.id)
          ? { ...item, isPurchased: true, purchasedPeriods: ['mon-wed', 'thu-sun'], purchasedAt: new Date() }
          : item,
      ),
    );
    addToast(`${itemIds.length} продуктів відмічено купленими`, '✅');
  }, [addToast]);

  // Products the user removed from the cart in the Silpo app lose their tag.
  const handleUntagged = useCallback((itemIds: string[]) => {
    const ids = new Set(itemIds);
    setItems((prev) => prev.map((item) => (ids.has(item.id) ? { ...item, silpo: undefined } : item)));
  }, []);
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

  const handleToggle = useCallback(async function toggle(itemId: string, checked: boolean, retried = false): Promise<void> {
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
      // 404 means our item ids went stale: the list was rebuilt server-side
      // (background catch-up generation, meal swap). Re-sync the list and
      // re-apply the toggle to the same product instead of silently
      // un-checking it.
      if (res.status === 404 && !retried) {
        try {
          const listRes = await fetch('/api/shopping-list');
          if (listRes.ok) {
            const data = await listRes.json() as { list: { items: ShoppingListItem[] } | null };
            if (data.list) {
              itemsRef.current = data.list.items;
              setItems(data.list.items);
              const match = data.list.items.find(
                (i) => i.isCustom === original.isCustom && i.name === original.name && i.unit === original.unit,
              );
              if (match) await toggle(match.id, checked, true);
              return;
            }
          }
        } catch {
          // network hiccup during re-sync — fall through to the revert below
        }
      }
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

  // Items the user still has to buy in the current period and hasn't pushed to
  // the Silpo cart yet — candidates for «Замовити в Сільпо».
  const orderItems: OrderItem[] = filteredItems
    .filter((i) => !i.isPurchased && !i.silpo)
    .map((i) => ({ itemId: i.id, name: i.name, quantity: i.quantity, unit: i.unit }));
  const hasPendingSilpoTags = items.some((i) => i.silpo && !i.isPurchased);

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
            <h1 className="font-heading font-semibold text-base text-ink dark:text-night-ink">
              Список покупок
            </h1>
            <p className="text-xs text-ink/60 dark:text-night-muted mt-0.5">
              {purchasedCount} з {totalCount} куплено
            </p>
          </div>
          {allDone && (
            <div className="flex items-center gap-1.5 text-sage-dark dark:text-sage-light text-sm font-semibold">
              <CheckCircle size={18} />
              <span>Готово!</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mt-3 h-1.5 bg-sage-light/40 dark:bg-night rounded-full overflow-hidden">
            <div
              className="h-full bg-sage rounded-full transition-all duration-300"
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

      {/* Order in Silpo (hidden unless the integration is enabled) */}
      <SilpoOrderBanner
        enabled={Boolean(silpo.data?.connected) && hasPendingSilpoTags}
        onConfirmed={handleOrderConfirmed}
        onUntagged={handleUntagged}
      />
      <SilpoOrderButton status={silpo.data} count={orderItems.length} onClick={() => setSilpoOpen(true)} />

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
          <div className="text-center py-12 text-ink/60 dark:text-night-muted text-sm">
            Немає продуктів для цього фільтра
          </div>
        )}
      </div>

      {/* Add custom item */}
      <AddCustomItemForm onAdd={handleAddCustom} />

      <SilpoOrderSheet
        isOpen={silpoOpen}
        onClose={() => setSilpoOpen(false)}
        items={orderItems}
        onAdded={handleSilpoAdded}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
