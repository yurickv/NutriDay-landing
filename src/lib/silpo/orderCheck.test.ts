import { describe, it, expect } from 'vitest';
import { findOrderSuggestions, findOrphanedTagIds, SilpoOrder } from './orderCheck';
import { ShoppingListItem } from '@/types/shoppingList';

const T0 = new Date('2026-09-18T10:00:00Z');
const later = (min: number) => new Date(T0.getTime() + min * 60_000).toISOString();

function item(id: string, productId: string | null, isPurchased = false): ShoppingListItem {
  return {
    id, name: `item ${id}`, quantity: 1, quantityByDay: [1, 0, 0, 0, 0, 0, 0], unit: 'шт',
    shoppingCategory: 'other', mealNames: [], forDays: [], isPurchased, purchasedPeriods: [], purchasedAt: null,
    isCustom: false,
    ...(productId ? { silpo: { productId, productName: `p ${productId}`, quantity: 1, addedAt: T0 } } : {}),
  };
}
const order = (orderId: string, createdAt: string, productIds: string[], removed: string[] = []): SilpoOrder => ({
  orderId, number: `#${orderId}`, status: 'received', createdAt,
  products: productIds.map((id) => ({ id, quantity: 1, removed: removed.includes(id) })),
});

describe('findOrderSuggestions', () => {
  it('groups tagged, unpurchased items by the order that contains them', () => {
    const items = [item('a', 'p1'), item('b', 'p2'), item('c', 'p3'), item('d', null), item('e', 'p5', true)];
    const orders = [order('o1', later(30), ['p1', 'p2', 'p5'])];
    expect(findOrderSuggestions(items, orders, [])).toEqual([
      { orderId: 'o1', orderNumber: '#o1', createdAt: later(30), itemIds: ['a', 'b'] },
    ]);
  });

  it('ignores orders placed before the item was added, removed lines and handled orders', () => {
    const items = [item('a', 'p1'), item('b', 'p2'), item('c', 'p3')];
    const orders = [
      order('old', later(-120), ['p1']),
      order('rm', later(20), ['p2'], ['p2']),
      order('done', later(25), ['p3']),
    ];
    expect(findOrderSuggestions(items, orders, ['done'])).toEqual([]);
  });

  it('tolerates a few minutes of clock skew before addedAt', () => {
    const items = [item('a', 'p1')];
    expect(findOrderSuggestions(items, [order('o', later(-5), ['p1'])], [])).toHaveLength(1);
    expect(findOrderSuggestions(items, [order('o', later(-30), ['p1'])], [])).toHaveLength(0);
  });

  it('assigns each item to the most recent matching order only', () => {
    const items = [item('a', 'p1'), item('b', 'p2')];
    const orders = [order('o1', later(10), ['p1', 'p2']), order('o2', later(60), ['p1'])];
    expect(findOrderSuggestions(items, orders, [])).toEqual([
      { orderId: 'o2', orderNumber: '#o2', createdAt: later(60), itemIds: ['a'] },
      { orderId: 'o1', orderNumber: '#o1', createdAt: later(10), itemIds: ['b'] },
    ]);
  });
});

describe('findOrphanedTagIds', () => {
  it('returns tagged unpurchased items that are neither in the cart nor in a later order', () => {
    const items = [item('a', 'p1'), item('b', 'p2'), item('c', 'p3'), item('d', 'p4', true)];
    const orders = [order('o', later(5), ['p2'])];
    expect(findOrphanedTagIds(items, orders, new Set(['p1']))).toEqual(['c']);
  });
});
