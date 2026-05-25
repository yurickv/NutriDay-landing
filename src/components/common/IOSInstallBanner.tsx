'use client';

import { useEffect, useState } from 'react';
import { X, Share, PlusSquare } from 'lucide-react';

const STORAGE_KEY = 'nd_ios_install_dismissed';

export default function IOSInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const dismissed = sessionStorage.getItem(STORAGE_KEY);

    if (isIOS && !isStandalone && !dismissed) {
      // Show after 3 seconds to not interrupt initial load
      const t = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div
        className="relative rounded-2xl bg-white dark:bg-gray-900 shadow-xl border border-gray-100 dark:border-gray-700 p-4"
        style={{ boxShadow: '0 8px 32px rgba(133,119,123,0.30)' }}
      >
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Закрити"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          {/* App icon */}
          <div
            className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
            style={{ background: '#f97316' }}
          >
            N
          </div>

          <div className="flex-1 pr-4">
            <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-0.5">
              Встановіть NutriDay
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
              Додайте на головний екран для швидкого доступу без браузера
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-500 font-bold text-xs">1</span>
            </div>
            <span>Натисніть</span>
            <Share className="w-3.5 h-3.5 text-blue-500 inline" />
            <span className="font-medium text-blue-500">"Поділитися"</span>
            <span>в нижній панелі Safari</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-500 font-bold text-xs">2</span>
            </div>
            <span>Оберіть</span>
            <PlusSquare className="w-3.5 h-3.5 text-blue-500 inline" />
            <span className="font-medium text-blue-500">"На головний екран"</span>
          </div>
        </div>

        {/* iOS-style bottom arrow indicator */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-900 border-r border-b border-gray-100 dark:border-gray-700 rotate-45" />
      </div>
    </div>
  );
}
