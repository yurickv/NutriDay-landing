'use client';

import { ShoppingCart, ChevronRight } from 'lucide-react';
import type { SilpoStatus } from '@/hooks/useSilpoConnection';

interface Props {
  status: SilpoStatus | null;
  count: number;
  onClick: () => void;
}

export function SilpoOrderButton({ status, count, onClick }: Props) {
  if (!status?.enabled) return null;

  if (!status.connected) {
    return (
      <div className="px-4 pt-3 pb-2">
        <a
          href={`/api/silpo/connect?returnTo=${encodeURIComponent('/shopping-list')}`}
          className="flex items-center justify-between rounded-2xl border border-ink/10 dark:border-night-ink/10 bg-card dark:bg-night-card px-4 py-3 text-sm"
        >
          <span className="flex items-center gap-2 text-ink/70 dark:text-night-muted">
            <ShoppingCart size={16} /> Замовити продукти в Сільпо
          </span>
          <span className="flex items-center gap-1 font-semibold text-terracotta">
            {status.status === 'expired' ? 'Підключити знову' : 'Підключити'} <ChevronRight size={16} />
          </span>
        </a>
      </div>
    );
  }

  if (count === 0) return null;

  return (
    <div className="px-4 pt-3 pb-2">
      <button
        onClick={onClick}
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-terracotta hover:bg-terracotta-dark text-card font-semibold py-3 text-sm shadow-soft active:scale-95 transition-all"
      >
        <ShoppingCart size={18} /> Замовити в Сільпо ({count})
      </button>
    </div>
  );
}
