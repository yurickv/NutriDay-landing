'use client';

import { useState } from 'react';
import { Download, CheckCircle2, Share, PlusSquare, Smartphone } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';

export default function InstallAppSettings() {
  const { isInstalled, isIOS, canPrompt, promptInstall } = usePwaInstall();
  const [busy, setBusy] = useState(false);

  // Already running as an installed app — confirm it to the user.
  if (isInstalled) {
    return (
      <div className="rounded-2xl bg-sage-light/40 dark:bg-sage/20 border border-sage-light dark:border-sage/40 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-card dark:bg-night-card flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-sage-dark dark:text-sage-light" />
          </div>
          <div>
            <p className="font-semibold text-sm text-ink dark:text-night-ink">
              Застосунок встановлено
            </p>
            <p className="text-xs text-ink/60 dark:text-night-muted">
              Ви користуєтесь Sytno як застосунком 🎉
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Android/Chrome — native install prompt is available.
  if (canPrompt) {
    const handleInstall = async () => {
      setBusy(true);
      try {
        await promptInstall();
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="rounded-2xl bg-card dark:bg-night-card shadow-soft p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-terracotta-light/20 dark:bg-terracotta/15 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-terracotta" />
          </div>
          <div>
            <p className="font-semibold text-sm text-ink dark:text-night-ink">
              Встановити на головний екран
            </p>
            <p className="text-xs text-ink/60 dark:text-night-muted">
              Швидкий доступ і робота без браузера
            </p>
          </div>
        </div>
        <button
          onClick={handleInstall}
          disabled={busy}
          className="w-full rounded-2xl bg-terracotta hover:bg-terracotta-dark text-card font-semibold shadow-soft active:scale-95 transition-all py-2.5 text-sm disabled:opacity-60"
        >
          {busy ? 'Встановлення…' : 'Встановити застосунок'}
        </button>
      </div>
    );
  }

  // iOS — no programmatic install, show the manual Share-menu steps.
  if (isIOS) {
    return (
      <div className="rounded-2xl bg-card dark:bg-night-card shadow-soft p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-sage-light/30 dark:bg-sage/20 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-sage-dark dark:text-sage-light" />
          </div>
          <div>
            <p className="font-semibold text-sm text-ink dark:text-night-ink">
              Додати на головний екран
            </p>
            <p className="text-xs text-ink/60 dark:text-night-muted">
              У Safari це робиться вручну за 2 кроки
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-ink/60 dark:text-night-muted">
            <div className="w-6 h-6 rounded-full bg-sage-light/30 dark:bg-sage/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sage-dark dark:text-sage-light font-bold text-xs">1</span>
            </div>
            <span>Натисніть</span>
            <Share className="w-3.5 h-3.5 text-sage-dark dark:text-sage-light inline" />
            <span className="font-medium text-sage-dark dark:text-sage-light">«Поділитися»</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink/60 dark:text-night-muted">
            <div className="w-6 h-6 rounded-full bg-sage-light/30 dark:bg-sage/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sage-dark dark:text-sage-light font-bold text-xs">2</span>
            </div>
            <span>Оберіть</span>
            <PlusSquare className="w-3.5 h-3.5 text-sage-dark dark:text-sage-light inline" />
            <span className="font-medium text-sage-dark dark:text-sage-light">«На головний екран»</span>
          </div>
        </div>
      </div>
    );
  }

  // Desktop / unsupported browser — installation isn't offered.
  return (
    <div className="rounded-2xl bg-card dark:bg-night-card shadow-soft p-4 text-sm text-ink/60 dark:text-night-muted">
      Відкрийте сайт у мобільному браузері (Chrome або Safari), щоб додати
      Sytno на головний екран.
    </div>
  );
}
