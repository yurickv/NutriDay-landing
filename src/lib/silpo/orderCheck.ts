import { ShoppingListItem } from '@/types/shoppingList';

export interface SilpoOrderProduct { id: string; quantity: number; removed: boolean }
export interface SilpoOrder {
  orderId: string;
  number: string;
  status: string;
  createdAt: string;
  products: SilpoOrderProduct[];
}

export interface OrderSuggestion {
  orderId: string;
  orderNumber: string;
  createdAt: string;
  itemIds: string[];
}

/** Orders can be timestamped slightly before our `addedAt` (server clocks); allow a small window. */
const CLOCK_SKEW_MS = 10 * 60 * 1000;

type Tagged = ShoppingListItem & { silpo: NonNullable<ShoppingListItem['silpo']> };

function pendingTagged(items: ShoppingListItem[]): Tagged[] {
  return items.filter((i): i is Tagged => Boolean(i.silpo) && !i.isPurchased);
}

function orderCovers(order: SilpoOrder, item: Tagged): boolean {
  const created = new Date(order.createdAt).getTime();
  const added = new Date(item.silpo.addedAt).getTime();
  if (created < added - CLOCK_SKEW_MS) return false;
  return order.products.some((p) => p.id === item.silpo.productId && !p.removed);
}

/**
 * For every Silpo order placed after items were pushed to the cart, list the
 * items it contains, newest order first. Each item appears in at most one
 * suggestion. Orders the user already confirmed/dismissed are skipped.
 */
export function findOrderSuggestions(
  items: ShoppingListItem[],
  orders: SilpoOrder[],
  handledOrderIds: string[],
): OrderSuggestion[] {
  const handled = new Set(handledOrderIds);
  const pending = pendingTagged(items);
  const taken = new Set<string>();
  const sorted = [...orders]
    .filter((o) => !handled.has(o.orderId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const out: OrderSuggestion[] = [];
  for (const order of sorted) {
    const itemIds = pending.filter((it) => !taken.has(it.id) && orderCovers(order, it)).map((it) => it.id);
    if (itemIds.length === 0) continue;
    itemIds.forEach((id) => taken.add(id));
    out.push({ orderId: order.orderId, orderNumber: order.number, createdAt: order.createdAt, itemIds });
  }
  return out;
}

/** Tagged items whose product is gone from the Silpo cart and never ordered: the tag is stale. */
export function findOrphanedTagIds(
  items: ShoppingListItem[],
  orders: SilpoOrder[],
  cartProductIds: Set<string>,
): string[] {
  return pendingTagged(items)
    .filter((it) => !cartProductIds.has(it.silpo.productId) && !orders.some((o) => orderCovers(o, it)))
    .map((it) => it.id);
}
