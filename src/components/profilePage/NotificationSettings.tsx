'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function NotificationSettings() {
  const { isSupported, isSubscribed, permission, isLoading, error, subscribe, unsubscribe } =
    usePushNotifications();

  if (!isSupported) {
    return (
      <div className="rounded-2xl bg-cream dark:bg-night p-4 text-sm text-ink/60 dark:text-night-muted">
        Push-сповіщення не підтримуються у вашому браузері.
        На iOS — спочатку додайте застосунок на головний екран.
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-cream dark:bg-night p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sage-light/40 dark:bg-sage/20 flex items-center justify-center flex-shrink-0">
            {isSubscribed ? (
              <Bell className="w-5 h-5 text-sage-dark dark:text-sage-light" />
            ) : (
              <BellOff className="w-5 h-5 text-ink/40 dark:text-night-muted" />
            )}
          </div>
          <div>
            <p className="font-semibold text-sm text-ink dark:text-night-ink">
              Push-нагадування
            </p>
            <p className="text-xs text-ink/60 dark:text-night-muted">
              {isSubscribed
                ? 'Увімкнено — отримуєте нагадування про прийоми їжі'
                : permission === 'denied'
                ? 'Заблоковано в налаштуваннях браузера'
                : 'Вимкнено — увімкніть щоб не пропустити прийоми їжі'}
            </p>
          </div>
        </div>

        {permission !== 'denied' && (
          <button
            onClick={isSubscribed ? unsubscribe : subscribe}
            disabled={isLoading}
            className={`flex-shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              isSubscribed
                ? 'bg-sage'
                : 'bg-ink/20 dark:bg-night-muted/40'
            }`}
            aria-label={isSubscribed ? 'Вимкнути сповіщення' : 'Увімкнути сповіщення'}
          >
            {isLoading ? (
              <Loader2 className="absolute left-1/2 -translate-x-1/2 w-4 h-4 text-card animate-spin" />
            ) : (
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-card shadow-soft transition-transform ${
                  isSubscribed ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-danger dark:text-danger-dark px-1">{error}</p>
      )}

      {isSubscribed && (
        <div className="text-xs text-ink/60 dark:text-night-muted bg-card dark:bg-night-card rounded-xl px-3 py-2 space-y-0.5">
          <p>🍳 Сніданок — 08:00</p>
          <p>🥗 Обід — 13:00</p>
          <p>🍽 Вечеря — 19:00</p>
        </div>
      )}
    </div>
  );
}
