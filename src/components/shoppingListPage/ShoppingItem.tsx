'use client';

import { ShoppingListItem } from '@/types/shoppingList';

interface ShoppingItemProps {
  item: ShoppingListItem;
  onToggle: (id: string, isPurchased: boolean) => void;
}

export function ShoppingItem({ item, onToggle }: ShoppingItemProps) {
  return (
    <button
      onClick={() => onToggle(item.id, !item.isPurchased)}
      className="flex items-center gap-3 w-full py-3 px-4 text-left active:bg-neutral-100 dark:active:bg-neutral-800 transition-colors rounded-xl"
      aria-label={`${item.isPurchased ? 'Скасувати' : 'Відмітити'}: ${item.name}`}
    >
      {/* Checkbox */}
      <span
        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          item.isPurchased
            ? 'bg-green-500 border-green-500'
            : 'border-neutral-300 dark:border-neutral-600'
        }`}
        aria-hidden="true"
      >
        {item.isPurchased && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>

      {/* Text */}
      <span className="flex-1 min-w-0">
        <span
          className={`text-sm font-medium block truncate transition-colors ${
            item.isPurchased
              ? 'line-through text-neutral-400 dark:text-neutral-600'
              : 'text-neutral-800 dark:text-neutral-200'
          }`}
        >
          {item.name}
        </span>
        {item.mealNames.length > 0 && (
          <span className="text-xs text-neutral-400 dark:text-neutral-500 truncate block">
            {item.mealNames.slice(0, 2).join(', ')}
            {item.mealNames.length > 2 ? ` +${item.mealNames.length - 2}` : ''}
          </span>
        )}
      </span>

      {/* Quantity */}
      <span
        className={`flex-shrink-0 text-sm font-semibold transition-colors ${
          item.isPurchased ? 'text-neutral-400' : 'text-neutral-600 dark:text-neutral-400'
        }`}
      >
        {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)} {item.unit}
      </span>

      {/* Custom badge */}
      {item.isCustom && (
        <span className="flex-shrink-0 text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-lg">
          своє
        </span>
      )}
    </button>
  );
}
