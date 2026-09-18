'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ShoppingCart, Unplug } from 'lucide-react';
import { useSilpoConnection } from '@/hooks/useSilpoConnection';
import { ToastContainer, ToastData } from '@/components/common/Toast';

export default function SilpoConnectSettings() {
  const { data, loading, disconnect, connectHref, flash } = useSilpoConnection();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  useEffect(() => {
    if (!flash) return;
    setToasts([{
      id: crypto.randomUUID(),
      message: flash === 'connected' ? 'Сільпо підключено' : 'Не вдалося підключити Сільпо',
      emoji: flash === 'connected' ? '🛒' : '😔',
      type: flash === 'connected' ? 'success' : 'error',
    }]);
  }, [flash]);

  if (loading || !data || !data.enabled) return null;

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnect();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const address = data.cart ? [data.cart.city, data.cart.street].filter(Boolean).join(', ') : null;

  return (
    <section className="mx-4 mb-4">
      <p className="text-xs font-semibold text-ink/50 dark:text-night-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <span>🛒</span> Сільпо
      </p>

      {data.connected ? (
        <div className="rounded-2xl bg-sage-light/40 dark:bg-sage/20 border border-sage-light dark:border-sage/40 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-card dark:bg-night-card flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-sage-dark dark:text-sage-light" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-ink dark:text-night-ink">Підключено</p>
              <p className="text-xs text-ink/60 dark:text-night-muted truncate">
                {address
                  ? `${data.cart?.deliveryType === 'SelfPickup' ? 'Самовивіз' : 'Доставка'}: ${address}`
                  : 'Кошик ще не налаштовано, адресу спитаємо при першому замовленні'}
              </p>
            </div>
          </div>
          {confirming ? (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => void handleDisconnect()}
                disabled={busy}
                className="flex-1 py-2 rounded-xl bg-danger text-card text-sm font-semibold active:scale-95 transition-all disabled:opacity-60"
              >
                {busy ? '…' : 'Відключити'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-2 rounded-xl border border-ink/10 dark:border-night-ink/10 text-sm font-semibold text-ink dark:text-night-ink"
              >
                Скасувати
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="mt-3 flex items-center gap-1.5 text-xs text-ink/50 dark:text-night-muted hover:text-danger transition-colors"
            >
              <Unplug size={14} /> Відключити акаунт Сільпо
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-card dark:bg-night-card shadow-soft p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-terracotta-light/20 dark:bg-terracotta/15 flex items-center justify-center flex-shrink-0">
              <ShoppingCart className="w-5 h-5 text-terracotta-dark dark:text-terracotta-light" />
            </div>
            <div>
              <p className="font-semibold text-sm text-ink dark:text-night-ink">
                {data.status === 'expired' ? 'Сесія Сільпо закінчилась' : 'Замовляйте продукти в Сільпо'}
              </p>
              <p className="text-xs text-ink/60 dark:text-night-muted mt-0.5">
                Підключіть акаунт, і список покупок можна буде одним натисканням додати в кошик Сільпо.
              </p>
            </div>
          </div>
          <a
            href={connectHref('/profile')}
            className="mt-4 w-full rounded-2xl bg-terracotta hover:bg-terracotta-dark text-card font-semibold shadow-soft active:scale-95 transition-all py-2.5 text-sm flex items-center justify-center gap-2"
          >
            {data.status === 'expired' ? 'Підключити знову' : 'Підключити Сільпо'}
          </a>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </section>
  );
}
