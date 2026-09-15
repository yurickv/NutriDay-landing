'use client';

import { ShoppingCategory } from '@/types/meals';
import { ShoppingListItem } from '@/types/shoppingList';
import { ShoppingItem } from './ShoppingItem';

const CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  meat: "М'ясо",
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

export function CategorySection({
  category,
  items,
  onToggle,
}: CategorySectionProps) {
  if (items.length === 0) return null;

  const purchasedCount = items.filter((i) => i.isPurchased).length;
  const allDone = purchasedCount === items.length;

  return (
    <div className="mb-2">
      {/* Category header */}
      <div className="flex items-center gap-2 px-4 py-2 mt-2sticky top-0 bg-cream dark:bg-night z-10">
        <span aria-hidden="true" className="text-base">
          {CATEGORY_EMOJI[category]}
        </span>
        <h3 className="text-xs font-heading font-semibold uppercase tracking-wider text-sage-dark dark:text-sage-light flex-1">
          {CATEGORY_LABELS[category]}
        </h3>
        <span
          className={`text-xs font-semibold ${allDone ? 'text-sage-dark dark:text-sage-light' : 'text-ink/50 dark:text-night-muted'}`}
        >
          {purchasedCount}/{items.length}
        </span>
      </div>

      {/* Items */}
      <div className="bg-card dark:bg-night-card rounded-2xl shadow-soft mx-3 overflow-hidden divide-y divide-ink/10 dark:divide-night-ink/10">
        {items.map((item) => (
          <ShoppingItem key={item.id} item={item} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}
