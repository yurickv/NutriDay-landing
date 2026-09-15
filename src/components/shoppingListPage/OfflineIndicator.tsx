'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-terracotta-light/20 dark:bg-terracotta/15 border border-terracotta-light dark:border-terracotta/40 text-terracotta-dark dark:text-terracotta-light text-xs font-medium">
      <WifiOff size={14} aria-hidden="true" />
      <span>Офлайн — зміни збережуться після підключення</span>
    </div>
  );
}
