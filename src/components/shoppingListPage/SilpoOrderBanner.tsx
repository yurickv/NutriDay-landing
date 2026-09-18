'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag } from 'lucide-react';

export interface OrderSuggestionView {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  itemIds: string[];
  itemNames: string[];
}

interface Props {
  /** Whether to ask the server at all (connected + some items tagged and unpurchased). */
  enabled: boolean;
  onConfirmed: (itemIds: string[]) => void;
  onUntagged: (itemIds: string[]) => void;
}

/**
 * «Схоже, ви оформили замовлення в Сільпо» — offers to tick the products that a
 * later Silpo order contains. Never marks anything without the user's click.
 */
export function SilpoOrderBanner({ enabled, onConfirmed, onUntagged }: Props) {
  const [suggestions, setSuggestions] = useState<OrderSuggestionView[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/silpo/orders/check');
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions: OrderSuggestionView[]; untagged: string[] };
        if (cancelled) return;
        setSuggestions(data.suggestions);
        if (data.untagged.length > 0) onUntagged(data.untagged);
      } catch {
        // banner is best-effort
      }
    })();
    return () => { cancelled = true; };
    // Run once per page open; the parent controls `enabled`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const act = async (s: OrderSuggestionView, action: 'confirm' | 'dismiss') => {
    setBusy(s.orderId);
    try {
      const res = await fetch('/api/silpo/orders/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: s.orderId, itemIds: s.itemIds, action }),
      });
      if (res.ok) {
        if (action === 'confirm') onConfirmed(s.itemIds);
        setSuggestions((prev) => prev.filter((x) => x.orderId !== s.orderId));
      }
    } finally {
      setBusy(null);
    }
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="px-4 pt-3 space-y-2">
      {suggestions.map((s) => (
        <div
          key={s.orderId}
          className="rounded-2xl bg-sage-light/40 dark:bg-sage/20 border border-sage-light dark:border-sage/40 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-card dark:bg-night-card flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-4 h-4 text-sage-dark dark:text-sage-light" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink dark:text-night-ink">
                Схоже, ви оформили замовлення №{s.orderNumber} у Сільпо
              </p>
              <p className="text-xs text-ink/60 dark:text-night-muted mt-0.5">
                Відмітити {s.itemIds.length} {s.itemIds.length === 1 ? 'продукт' : 'продуктів'} купленими?{' '}
                <span className="text-ink/50 dark:text-night-muted">
                  {s.itemNames.slice(0, 3).join(', ')}{s.itemNames.length > 3 ? ` +${s.itemNames.length - 3}` : ''}
                </span>
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => void act(s, 'confirm')}
              disabled={busy === s.orderId}
              className="flex-1 py-2 rounded-xl bg-sage hover:bg-sage-dark text-card text-sm font-semibold active:scale-95 transition-all disabled:opacity-60"
            >
              {busy === s.orderId ? '…' : 'Відмітити'}
            </button>
            <button
              onClick={() => void act(s, 'dismiss')}
              disabled={busy === s.orderId}
              className="flex-1 py-2 rounded-xl border border-ink/10 dark:border-night-ink/10 text-sm font-semibold text-ink dark:text-night-ink disabled:opacity-60"
            >
              Ні
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
