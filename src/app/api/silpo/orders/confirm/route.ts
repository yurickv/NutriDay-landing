import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { ShoppingListItem } from '@/types/shoppingList';

/**
 * Banner actions. `confirm` marks the listed items purchased for the whole week
 * (same shape as a manual tick in the «Весь тиждень» view); both actions remember
 * the order so the banner does not come back.
 */
export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { orderId?: unknown; itemIds?: unknown; action?: unknown };
  const orderId = typeof body.orderId === 'string' ? body.orderId : '';
  const action = body.action === 'confirm' || body.action === 'dismiss' ? body.action : null;
  const itemIds = Array.isArray(body.itemIds) ? body.itemIds.filter((x): x is string => typeof x === 'string') : [];
  if (!orderId || !action) return NextResponse.json({ error: 'orderId and action required' }, { status: 400 });

  const db = await getDb();
  const col = db.collection('shopping_lists');
  const list = await col.findOne<{ _id: ObjectId; items: ShoppingListItem[] }>({ userEmail }, { sort: { weekStartDate: -1 } });
  if (!list) return NextResponse.json({ error: 'No shopping list' }, { status: 404 });

  const now = new Date();
  const known = new Set(list.items.map((i) => i.id));
  const targets = itemIds.filter((id) => known.has(id));

  if (action === 'confirm' && targets.length > 0) {
    await col.updateOne(
      { _id: list._id },
      {
        $set: {
          'items.$[el].isPurchased': true,
          'items.$[el].purchasedPeriods': ['mon-wed', 'thu-sun'],
          'items.$[el].purchasedAt': now,
          updatedAt: now,
        },
      },
      { arrayFilters: [{ 'el.id': { $in: targets } }] },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (col as any).updateOne({ _id: list._id }, { $addToSet: { silpoOrdersHandled: orderId }, $set: { updatedAt: now } });

  return NextResponse.json({ success: true, itemIds: action === 'confirm' ? targets : [] });
}
