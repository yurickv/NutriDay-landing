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
      <div className="relative rounded-2xl bg-card dark:bg-night-card shadow-soft border border-ink/10 dark:border-night-ink/10 p-4">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-ink/40 hover:text-ink/60 dark:text-night-muted dark:hover:text-night-ink"
          aria-label="Закрити"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3">
          {/* App icon */}
          <div
            className="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-white font-bold text-lg"
            style={{ background: 'var(--color-terracotta)' }}
          >
            E
          </div>

          <div className="flex-1 pr-4">
            <p className="font-semibold text-sm text-ink dark:text-night-ink mb-0.5">
              Встановіть EasyMenu
            </p>
            <p className="text-xs text-ink/60 dark:text-night-muted leading-snug">
              Додайте на головний екран для швидкого доступу без браузера
            </p>
          </div>
        </div>

        {canPrompt ? (
          // Android/Chrome — native install in one tap.
          <button
            onClick={handleInstall}
            disabled={busy}
            className="mt-3 w-full rounded-2xl bg-terracotta hover:bg-terracotta-dark text-card font-semibold shadow-soft active:scale-95 transition-all py-2.5 text-sm disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            {busy ? 'Встановлення…' : 'Встановити'}
          </button>
        ) : (
          // iOS Safari — manual steps.
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-xs text-ink/60 dark:text-night-muted">
              <div className="w-6 h-6 rounded-md bg-sage-light/30 dark:bg-sage/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sage-dark dark:text-sage-light font-bold text-xs">1</span>
              </div>
              <span>Натисніть</span>
              <Share className="w-3.5 h-3.5 text-sage-dark dark:text-sage-light inline" />
              <span className="font-medium text-sage-dark dark:text-sage-light">«Поділитися»</span>
              <span>в нижній панелі Safari</span>
            </div>

            <div className="flex items-center gap-2 text-xs text-ink/60 dark:text-night-muted">
              <div className="w-6 h-6 rounded-md bg-sage-light/30 dark:bg-sage/20 flex items-center justify-center flex-shrink-0">
                <span className="text-sage-dark dark:text-sage-light font-bold text-xs">2</span>
              </div>
              <span>Оберіть</span>
              <PlusSquare className="w-3.5 h-3.5 text-sage-dark dark:text-sage-light inline" />
              <span className="font-medium text-sage-dark dark:text-sage-light">«На головний екран»</span>
            </div>
          </div>
        )}

        {/* iOS-style bottom arrow indicator */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-card dark:bg-night-card border-r border-b border-ink/10 dark:border-night-ink/10 rotate-45" />
      </div>
    </div>
  );
}
