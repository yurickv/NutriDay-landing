import { describe, it, expect } from 'vitest';
import { mergeShoppingItems } from './shoppingListBuilder';
import { ShoppingListItem } from '../../types/shoppingList';

function makeItem(overrides: Partial<ShoppingListItem> = {}): ShoppingListItem {
  return {
    id: 'id-default',
    name: 'Куряче філе',
    quantity: 700,
    quantityByDay: [100, 100, 100, 100, 100, 100, 100],
    unit: 'г',
    shoppingCategory: 'meat',
    mealNames: ['Курка з рисом'],
    forDays: ['Понеділок'],
    isPurchased: false,
    purchasedPeriods: [],
    purchasedAt: null,
    isCustom: false,
    ...overrides,
  };
}

describe('mergeShoppingItems', () => {
  it('preserves the previous item id when the same product (name+unit) survives a rebuild', () => {
    const previous = [makeItem({ id: 'old-id' })];
    const rebuilt = [makeItem({ id: 'new-id' })];

    const merged = mergeShoppingItems(previous, rebuilt);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('old-id');
  });

  it('carries purchasedPeriods of a fully purchased item over a rebuild', () => {
    const purchasedAt = new Date('2026-08-24T14:00:00Z');
    const previous = [
      makeItem({
        id: 'old-id',
        isPurchased: true,
        purchasedPeriods: ['mon-wed', 'thu-sun'],
        purchasedAt,
      }),
    ];
    const rebuilt = [makeItem({ id: 'new-id' })];

    const merged = mergeShoppingItems(previous, rebuilt);

    expect(merged[0].isPurchased).toBe(true);
    expect(merged[0].purchasedPeriods).toEqual(['mon-wed', 'thu-sun']);
    expect(merged[0].purchasedAt).toEqual(purchasedAt);
  });

  it('carries a partial period purchase (isPurchased=false, one period ticked) over a rebuild', () => {
    const previous = [
      makeItem({ id: 'old-id', isPurchased: false, purchasedPeriods: ['mon-wed'] }),
    ];
    const rebuilt = [makeItem({ id: 'new-id' })];

    const merged = mergeShoppingItems(previous, rebuilt);

    expect(merged[0].isPurchased).toBe(false);
    expect(merged[0].purchasedPeriods).toEqual(['mon-wed']);
  });

  it('does not carry state between different products and keeps custom items as-is', () => {
    const previous = [
      makeItem({ id: 'old-rice', name: 'Рис', isPurchased: true, purchasedPeriods: ['mon-wed', 'thu-sun'] }),
      makeItem({ id: 'custom-1', name: 'Серветки', unit: 'шт', isCustom: true, quantityByDay: [] }),
    ];
    const rebuilt = [makeItem({ id: 'new-buckwheat', name: 'Гречка' })];

    const merged = mergeShoppingItems(previous, rebuilt);

    expect(merged).toHaveLength(2);
    const buckwheat = merged.find((i) => i.name === 'Гречка');
    expect(buckwheat?.id).toBe('new-buckwheat');
    expect(buckwheat?.isPurchased).toBe(false);
    const custom = merged.find((i) => i.isCustom);
    expect(custom?.id).toBe('custom-1');
    expect(custom?.name).toBe('Серветки');
  });
});
