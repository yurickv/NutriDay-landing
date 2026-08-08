'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { CustomEntry } from '@/types/meals';

interface CustomEntryCardProps {
  entry: CustomEntry;
  onDelete: (entryId: string) => Promise<void>;
}

export function CustomEntryCard({ entry, onDelete }: CustomEntryCardProps) {
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await onDelete(entry.id);
      if ('vibrate' in navigator) navigator.vibrate(20);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="article"
      className="relative flex items-center gap-3 p-4 rounded-2xl shadow-soft bg-card dark:bg-night-card border border-sage-light dark:border-sage/40"
      aria-label={`Власна страва: ${entry.name}`}
    >
      <span className="text-3xl flex-shrink-0 opacity-80" aria-hidden="true">
        {entry.emoji}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-snug truncate text-ink dark:text-night-ink">
          {entry.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs font-semibold text-ink dark:text-night-ink">{entry.calories} ккал</span>
          {entry.grams != null && (
            <>
              <span className="text-xs text-ink/60 dark:text-night-muted">·</span>
              <span className="text-xs text-ink/60 dark:text-night-muted">{entry.grams} г</span>
            </>
          )}
          <span className="text-xs text-ink/60 dark:text-night-muted">·</span>
          <span className="text-xs text-ink/60 dark:text-night-muted">
            {entry.protein}г Б · {entry.fat}г Ж · {entry.carbs}г В
          </span>
        </div>
      </div>

      <button
        onClick={handleDelete}
        disabled={loading}
        className="p-2 rounded-full text-ink/40 dark:text-night-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0 disabled:opacity-40"
        aria-label="Видалити запис"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
