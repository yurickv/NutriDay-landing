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
          className="flex items-center gap-2 w-full py-3 px-4 rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 text-sm font-medium hover:border-orange-300 hover:text-orange-400 transition-colors"
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
        className="bg-white dark:bg-neutral-900 rounded-2xl p-4 shadow-sm border border-neutral-100 dark:border-neutral-800"
      >
        <p className="text-xs font-semibold text-neutral-500 mb-3">Додати свій продукт</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Назва продукту..."
            autoFocus
            className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-orange-400"
          />
          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-opacity"
          >
            {loading ? '…' : 'Додати'}
          </button>
        </div>
        <button
          type="button"
          onClick={() => { setIsOpen(false); setName(''); }}
          className="mt-2 text-xs text-neutral-400 hover:text-neutral-600"
        >
          Скасувати
        </button>
      </form>
    </div>
  );
}
