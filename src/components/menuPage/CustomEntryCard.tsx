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
      className="relative flex items-center gap-3 p-4 rounded-2xl shadow-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
      aria-label={`Власна страва: ${entry.name}`}
    >
      <span className="text-3xl flex-shrink-0 opacity-80" aria-hidden="true">
        {entry.emoji}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold leading-snug truncate text-neutral-900 dark:text-neutral-100">
          {entry.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs font-semibold text-main">{entry.calories} ккал</span>
          {entry.grams != null && (
            <>
              <span className="text-xs text-neutral-400">·</span>
              <span className="text-xs text-neutral-400">{entry.grams} г</span>
            </>
          )}
          <span className="text-xs text-neutral-400">·</span>
          <span className="text-xs text-neutral-400">
            {entry.protein}г Б · {entry.fat}г Ж · {entry.carbs}г В
          </span>
        </div>
      </div>

      <button
        onClick={handleDelete}
        disabled={loading}
        className="p-2 rounded-full text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0 disabled:opacity-40"
        aria-label="Видалити запис"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
