'use client';

import { useEffect, useState } from 'react';
import { X, Share, PlusSquare, Download } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';

const STORAGE_KEY = 'nd_install_dismissed';

/**
 * Floating "add to home screen" prompt.
 *  - Android/Chrome: a single "Встановити" button that fires the native dialog.
 *  - iOS Safari: manual Share → На головний екран instructions.
 * Hidden once installed or dismissed (for the session).
 */
export default function InstallBanner() {
  const { isInstalled, isIOS, canPrompt, promptInstall } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  const eligible = !isInstalled && (canPrompt || isIOS);

  useEffect(() => {
    if (!eligible) {
      setVisible(false);
      return;
    }
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    // Delay so it doesn't interrupt the initial load.
    const t = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(t);
  }, [eligible]);

  const dismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  const handleInstall = async () => {
    setBusy(true);
    try {
      const outcome = await promptInstall();
      if (outcome === 'accepted') setVisible(false);
    } finally {
      setBusy(false);
    }
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
            E
          </div>

          <div className="flex-1 pr-4">
            <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-0.5">
              Встановіть EasyMenu
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
              Додайте на головний екран для швидкого доступу без браузера
            </p>
          </div>
        </div>

        {canPrompt ? (
          // Android/Chrome — native install in one tap.
          <button
            onClick={handleInstall}
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            {busy ? 'Встановлення…' : 'Встановити'}
          </button>
        ) : (
          // iOS Safari — manual steps.
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-500 font-bold text-xs">1</span>
              </div>
              <span>Натисніть</span>
              <Share className="w-3.5 h-3.5 text-blue-500 inline" />
              <span className="font-medium text-blue-500">«Поділитися»</span>
              <span>в нижній панелі Safari</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-500 font-bold text-xs">2</span>
              </div>
              <span>Оберіть</span>
              <PlusSquare className="w-3.5 h-3.5 text-blue-500 inline" />
              <span className="font-medium text-blue-500">«На головний екран»</span>
            </div>
          </div>
        )}

        {/* iOS-style bottom arrow indicator */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-900 border-r border-b border-gray-100 dark:border-gray-700 rotate-45" />
      </div>
    </div>
  );
}
