'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export default function NotificationSettings() {
  const { isSupported, isSubscribed, permission, isLoading, error, subscribe, unsubscribe } =
    usePushNotifications();

  if (!isSupported) {
    return (
      <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 p-4 text-sm text-gray-500 dark:text-gray-400">
        Push-сповіщення не підтримуються у вашому браузері.
        На iOS — спочатку додайте застосунок на головний екран.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
            {isSubscribed ? (
              <Bell className="w-5 h-5 text-orange-500" />
            ) : (
              <BellOff className="w-5 h-5 text-gray-400" />
            )}
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">
              Push-нагадування
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
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
                ? 'bg-orange-500'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
            aria-label={isSubscribed ? 'Вимкнути сповіщення' : 'Увімкнути сповіщення'}
          >
            {isLoading ? (
              <Loader2 className="absolute left-1/2 -translate-x-1/2 w-4 h-4 text-white animate-spin" />
            ) : (
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isSubscribed ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 dark:text-red-400 px-1">{error}</p>
      )}

      {isSubscribed && (
        <div className="text-xs text-gray-500 dark:text-gray-400 bg-orange-50 dark:bg-orange-900/10 rounded-xl px-3 py-2 space-y-0.5">
          <p>🍳 Сніданок — 08:00</p>
          <p>🥗 Обід — 13:00</p>
          <p>🍽 Вечеря — 19:00</p>
        </div>
      )}
    </div>
  );
}
