'use client';

import { ShoppingCategory } from '@/types/meals';
import { ShoppingListItem } from '@/types/shoppingList';
import { ShoppingItem } from './ShoppingItem';

const CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  meat: 'М\'ясо',
  fish: 'Риба',
  dairy: 'Молочне',
  vegetables: 'Овочі',
  fruits: 'Фрукти',
  grains: 'Крупи та хліб',
  legumes: 'Бобові',
  oils: 'Олія та жири',
  spices: 'Приправи',
  other: 'Інше',
};

const CATEGORY_EMOJI: Record<ShoppingCategory, string> = {
  meat: '🥩',
  fish: '🐟',
  dairy: '🥛',
  vegetables: '🥦',
  fruits: '🍎',
  grains: '🌾',
  legumes: '🫘',
  oils: '🫙',
  spices: '🌿',
  other: '🛒',
};

interface CategorySectionProps {
  category: ShoppingCategory;
  items: ShoppingListItem[];
  onToggle: (id: string, isPurchased: boolean) => void;
}

export function CategorySection({ category, items, onToggle }: CategorySectionProps) {
  if (items.length === 0) return null;

  const purchasedCount = items.filter((i) => i.isPurchased).length;
  const allDone = purchasedCount === items.length;

  return (
    <div className="mb-2">
      {/* Category header */}
      <div className="flex items-center gap-2 px-4 py-2 sticky top-0 bg-neutral-50 dark:bg-neutral-950 z-10">
        <span aria-hidden="true" className="text-base">{CATEGORY_EMOJI[category]}</span>
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex-1">
          {CATEGORY_LABELS[category]}
        </h3>
        <span className={`text-xs font-semibold ${allDone ? 'text-green-500' : 'text-neutral-400'}`}>
          {purchasedCount}/{items.length}
        </span>
      </div>

      {/* Items */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl mx-3 overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800">
        {items.map((item) => (
          <ShoppingItem key={item.id} item={item} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}
