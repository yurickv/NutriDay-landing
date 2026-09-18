import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { ShoppingListItem } from '@/types/shoppingList';
import { callTool } from '@/lib/silpo/client';
import { getConnection } from '@/lib/silpo/connections';
import { getCartRaw } from '@/lib/silpo/cartContext';
import { findOrderSuggestions, findOrphanedTagIds, SilpoOrder } from '@/lib/silpo/orderCheck';
import { silpoErrorResponse } from '@/lib/silpo/apiErrors';

interface OrdersResponse { orders?: SilpoOrder[] }
interface MyCartResponse { exists: boolean; shoppingCartId: string | null }
type ListDoc = { _id: ObjectId; items: ShoppingListItem[]; silpoOrdersHandled?: string[] };

/**
 * Called when the shopping list opens. Finds Silpo orders that contain products
 * we pushed to the cart (→ banner suggestions) and drops tags for products the
 * user removed from the cart in the Silpo app.
 */
export async function GET() {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const list = await db.collection('shopping_lists').findOne<ListDoc>({ userEmail }, { sort: { weekStartDate: -1 } });
  const pending = list?.items.filter((i) => i.silpo && !i.isPurchased) ?? [];
  if (!list || pending.length === 0) return NextResponse.json({ suggestions: [], untagged: [] });

  const conn = await getConnection(userEmail);
  if (!conn || conn.status !== 'active') return NextResponse.json({ suggestions: [], untagged: [] });

  try {
    const [ordersRes, mine] = await Promise.all([
      callTool<OrdersResponse>(userEmail, 'silpo_get_my_online_orders', { limit: 10 }),
      callTool<MyCartResponse>(userEmail, 'silpo_get_my_shopping_cart'),
    ]);
    const orders = ordersRes.orders ?? [];

    const cartProductIds = new Set<string>();
    if (mine.exists && mine.shoppingCartId) {
      const cart = await getCartRaw(userEmail, mine.shoppingCartId);
      for (const s of cart.shipments ?? []) {
        for (const p of (s.products ?? []) as Array<{ productId?: string }>) {
          if (p.productId) cartProductIds.add(p.productId);
        }
      }
    }

    const suggestions = findOrderSuggestions(list.items, orders, list.silpoOrdersHandled ?? []);
    const untagged = findOrphanedTagIds(list.items, orders, cartProductIds);

    if (untagged.length > 0) {
      await db.collection('shopping_lists').updateOne(
        { _id: list._id },
        { $unset: { 'items.$[el].silpo': '' }, $set: { updatedAt: new Date() } },
        { arrayFilters: [{ 'el.id': { $in: untagged } }] },
      );
    }

    const names = new Map(list.items.map((i) => [i.id, i.name]));
    return NextResponse.json({
      suggestions: suggestions.map((s) => ({ ...s, itemNames: s.itemIds.map((id) => names.get(id) ?? '') })),
      untagged,
    });
  } catch (err) {
    return silpoErrorResponse(err);
  }
}
