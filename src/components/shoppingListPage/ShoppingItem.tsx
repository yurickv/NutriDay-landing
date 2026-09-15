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
      className="flex items-center gap-3 w-full py-3 px-4 text-left active:bg-cream dark:active:bg-night transition-colors rounded-xl"
      aria-label={`${item.isPurchased ? 'Скасувати' : 'Відмітити'}: ${item.name}`}
    >
      {/* Checkbox */}
      <span
        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          item.isPurchased
            ? 'bg-sage border-sage text-card'
            : 'border-ink/20 dark:border-night-muted/60'
        }`}
        aria-hidden="true"
      >
        {item.isPurchased && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>

      {/* Text */}
      <span className="flex-1 min-w-0">
        <span
          className={`text-sm font-medium block truncate transition-colors ${
            item.isPurchased
              ? 'line-through text-ink/40 dark:text-night-muted'
              : 'text-ink dark:text-night-ink'
          }`}
        >
          {item.name}
        </span>
        {item.mealNames.length > 0 && (
          <span className="text-xs text-ink/50 dark:text-night-muted truncate block">
            {item.mealNames.slice(0, 2).join(', ')}
            {item.mealNames.length > 2 ? ` +${item.mealNames.length - 2}` : ''}
          </span>
        )}
      </span>

      {/* Quantity */}
      <span
        className={`flex-shrink-0 text-sm font-semibold transition-colors ${
          item.isPurchased ? 'text-ink/40 dark:text-night-muted' : 'text-ink/60 dark:text-night-muted'
        }`}
      >
        {item.quantity % 1 === 0 ? item.quantity : item.quantity.toFixed(1)} {item.unit}
      </span>

      {/* Custom badge */}
      {item.isCustom && (
        <span className="flex-shrink-0 text-xs bg-cream dark:bg-night text-ink/50 dark:text-night-muted px-1.5 py-0.5 rounded-xl">
          своє
        </span>
      )}
    </button>
  );
}
