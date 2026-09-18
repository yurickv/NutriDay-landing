'use client';

import { ShoppingCart, ChevronRight, ExternalLink } from 'lucide-react';
import type { SilpoStatus } from '@/hooks/useSilpoConnection';
import { silpoOpenLink } from '@/lib/silpo/appLink';

interface Props {
  status: SilpoStatus | null;
  count: number;
  onClick: () => void;
}

/** «Кошик Сільпо ↗»: opens the Silpo app when installed (Universal Link / intent://), else the site. */
function SilpoCartLink({ compact }: { compact: boolean }) {
  const href = silpoOpenLink(typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const isIntent = href.startsWith('intent://');
  return (
    <a
      href={href}
      target={isIntent ? undefined : '_blank'}
      rel="noopener noreferrer"
      className={`flex items-center justify-center gap-1.5 rounded-2xl border border-ink/10 dark:border-night-ink/10 bg-card dark:bg-night-card text-sm font-semibold text-ink dark:text-night-ink active:scale-95 transition-all ${
        compact ? 'px-3 py-3 whitespace-nowrap' : 'w-full px-4 py-3'
      }`}
      aria-label="Відкрити кошик Сільпо"
    >
      <ShoppingCart size={16} className="text-sage-dark dark:text-sage-light" />
      Кошик Сільпо
      <ExternalLink size={14} className="text-ink/40 dark:text-night-muted" />
    </a>
  );
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

  // Everything is already in the cart (or bought): only the shortcut to the Silpo cart.
  if (count === 0) {
    return (
      <div className="px-4 pt-3 pb-2">
        <SilpoCartLink compact={false} />
      </div>
    );
  }

  return (
    <div className="px-4 pt-3 pb-2 flex gap-2">
      <button
        onClick={onClick}
        className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-terracotta hover:bg-terracotta-dark text-card font-semibold py-3 text-sm shadow-soft active:scale-95 transition-all"
      >
        <ShoppingCart size={18} /> Замовити в Сільпо ({count})
      </button>
      <SilpoCartLink compact />
    </div>
  );
}
