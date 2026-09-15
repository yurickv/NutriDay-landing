'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ShoppingListView } from '@/components/shoppingListPage/ShoppingListView';
import { ShoppingList } from '@/types/shoppingList';
import { ShoppingCart, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/common/ThemeToggle';

type PageState = 'loading' | 'no-list' | 'has-list' | 'error';

export default function ShoppingListPage() {
  const [state, setState] = useState<PageState>('loading');
  const [list, setList] = useState<ShoppingList | null>(null);

  const fetchList = async () => {
    setState('loading');
    try {
      const res = await fetch('/api/shopping-list');
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { list: ShoppingList | null };
      setList(data.list);
      setState(data.list ? 'has-list' : 'no-list');
    } catch {
      setState('error');
    }
  };

  useEffect(() => {
    void fetchList();
  }, []);

  return (
    <AppShell>
      <div className="flex items-center justify-between px-4 py-3 bg-card dark:bg-night-card border-b border-ink/10 dark:border-night-ink/10">
        <h1 className="font-heading font-semibold text-lg text-ink dark:text-night-ink">Список покупок</h1>
        <ThemeToggle />
      </div>

      {state === 'loading' && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="text-4xl animate-spin inline-block">🌀</div>
            <p className="text-sm text-ink/60 dark:text-night-muted">Завантажуємо…</p>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-4 text-center">
          <span className="text-5xl">😔</span>
          <p className="text-sm text-ink/60 dark:text-night-muted">Не вдалося завантажити список покупок</p>
          <button
            onClick={() => void fetchList()}
            className="flex items-center gap-2 text-sm text-terracotta hover:text-terracotta-dark font-semibold transition-colors"
          >
            <RefreshCw size={16} />
            Спробувати знову
          </button>
        </div>
      )}

      {state === 'no-list' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-4 text-center">
          <ShoppingCart size={48} className="text-ink/30 dark:text-night-muted" />
          <h1 className="font-heading font-semibold text-lg text-ink dark:text-night-ink">
            Список покупок порожній
          </h1>
          <p className="text-sm text-ink/60 dark:text-night-muted max-w-xs">
            Спочатку згенеруйте тижневе меню — список покупок сформується автоматично.
          </p>
          <Link
            href="/menu"
            className="flex items-center gap-2 bg-terracotta hover:bg-terracotta-dark text-card px-6 py-3 rounded-2xl font-semibold text-sm shadow-soft active:scale-95 transition-all"
          >
            Перейти до меню
          </Link>
        </div>
      )}

      {state === 'has-list' && list && (
        <ShoppingListView initialList={list} />
      )}
    </AppShell>
  );
}
