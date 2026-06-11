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
      <div className="rounded-2xl border border-green-100 dark:border-green-900/40 bg-green-50 dark:bg-green-950/20 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">
              Застосунок встановлено
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ви користуєтесь EasyMenu як застосунком 🎉
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
      <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">
              Встановити на головний екран
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Швидкий доступ і робота без браузера
            </p>
          </div>
        </div>
        <button
          onClick={handleInstall}
          disabled={busy}
          className="w-full rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
        >
          {busy ? 'Встановлення…' : 'Встановити застосунок'}
        </button>
      </div>
    );
  }

  // iOS — no programmatic install, show the manual Share-menu steps.
  if (isIOS) {
    return (
      <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">
              Додати на головний екран
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              У Safari це робиться вручну за 2 кроки
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-500 font-bold text-xs">1</span>
            </div>
            <span>Натисніть</span>
            <Share className="w-3.5 h-3.5 text-blue-500 inline" />
            <span className="font-medium text-blue-500">«Поділитися»</span>
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
      </div>
    );
  }

  // Desktop / unsupported browser — installation isn't offered.
  return (
    <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 p-4 text-sm text-gray-500 dark:text-gray-400">
      Відкрийте сайт у мобільному браузері (Chrome або Safari), щоб додати
      EasyMenu на головний екран.
    </div>
  );
}
