'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ShoppingListView } from '@/components/shoppingListPage/ShoppingListView';
import { ShoppingList } from '@/types/shoppingList';
import { ShoppingCart, RefreshCw } from 'lucide-react';
import Link from 'next/link';

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
      {state === 'loading' && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="text-4xl animate-spin inline-block">🌀</div>
            <p className="text-sm text-neutral-500">Завантажуємо…</p>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-4 text-center">
          <span className="text-5xl">😔</span>
          <p className="text-sm text-neutral-500">Не вдалося завантажити список покупок</p>
          <button
            onClick={() => void fetchList()}
            className="flex items-center gap-2 text-sm text-orange-500 font-semibold"
          >
            <RefreshCw size={16} />
            Спробувати знову
          </button>
        </div>
      )}

      {state === 'no-list' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-4 text-center">
          <ShoppingCart size={48} className="text-neutral-300 dark:text-neutral-600" />
          <h1 className="text-lg font-bold text-neutral-700 dark:text-neutral-300">
            Список покупок порожній
          </h1>
          <p className="text-sm text-neutral-400 max-w-xs">
            Спочатку згенеруйте тижневе меню — список покупок сформується автоматично.
          </p>
          <Link
            href="/menu"
            className="flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-2xl font-semibold text-sm shadow-sm active:scale-95 transition-transform"
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
