'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

interface AddCustomItemFormProps {
  onAdd: (name: string) => Promise<void>;
}

export function AddCustomItemForm({ onAdd }: AddCustomItemFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      await onAdd(trimmed);
      setName('');
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="px-3 pb-4">
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 w-full py-3 px-4 rounded-2xl border-2 border-dashed border-sage-light dark:border-sage/40 text-ink/50 dark:text-night-muted text-sm font-medium hover:border-sage hover:text-sage-dark dark:hover:text-sage-light transition-colors"
        >
          <Plus size={16} />
          Додати свій продукт
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 pb-4">
      <form
        onSubmit={handleSubmit}
        className="bg-card dark:bg-night-card rounded-2xl p-4 shadow-soft"
      >
        <p className="text-xs font-semibold text-ink/60 dark:text-night-muted mb-3">Додати свій продукт</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Назва продукту..."
            autoFocus
            className="flex-1 text-sm px-3 py-2.5 rounded-xl bg-card dark:bg-night-card border border-ink/10 dark:border-night-ink/10 text-ink dark:text-night-ink placeholder:text-ink/40 dark:placeholder:text-night-muted focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage-light/50"
          />
          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="px-4 py-2.5 bg-terracotta hover:bg-terracotta-dark text-card font-semibold rounded-2xl shadow-soft text-sm disabled:opacity-50 active:scale-95 transition-all"
          >
            {loading ? '…' : 'Додати'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => { setIsOpen(false); setName(''); }}
          className="mt-2 text-xs text-ink/50 dark:text-night-muted hover:text-ink dark:hover:text-night-ink transition-colors"
        >
          Скасувати
        </button>
      </form>
    </div>
  );
}
