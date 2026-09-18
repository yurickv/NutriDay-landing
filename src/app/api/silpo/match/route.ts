import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { ShoppingListItem } from '@/types/shoppingList';
import { UserProfile } from '@/types/userProfile';
import { resolveCartContext } from '@/lib/silpo/cartContext';
import { matchShoppingItems, MatchInput } from '@/lib/silpo/matchProducts';
import { silpoErrorResponse } from '@/lib/silpo/apiErrors';

const MAX_ITEMS = 60;

export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { items?: Array<{ itemId?: unknown; quantity?: unknown }> };
  const requested = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
  if (requested.length === 0) return NextResponse.json({ error: 'items required' }, { status: 400 });

  const db = await getDb();
  const list = await db.collection('shopping_lists').findOne<{ items: ShoppingListItem[] }>(
    { userEmail },
    { sort: { weekStartDate: -1 } },
  );
  if (!list) return NextResponse.json({ error: 'No shopping list' }, { status: 404 });

  // Names/units come from the DB, never from the client.
  const byId = new Map(list.items.map((i) => [i.id, i]));
  const items: MatchInput[] = [];
  for (const r of requested) {
    if (typeof r.itemId !== 'string') continue;
    const item = byId.get(r.itemId);
    if (!item) continue;
    const quantity = typeof r.quantity === 'number' && r.quantity > 0 ? r.quantity : item.quantity;
    items.push({ itemId: item.id, name: item.name, quantity, unit: item.unit });
  }
  // None of the ids exist any more: the list was rebuilt (menu swap / catch-up
  // generation) after the page loaded. The client tells the user to reload.
  if (items.length === 0) return NextResponse.json({ error: 'stale-list' }, { status: 409 });

  const profile = await db.collection('user_profiles').findOne<UserProfile>({ userEmail });
  const prefs = {
    allergies: profile?.allergies ?? [],
    dislikedFoods: profile?.dislikedFoods ?? [],
    dietaryPreferences: profile?.dietaryPreferences ?? [],
  };

  try {
    const context = await resolveCartContext(userEmail);
    if (context.kind === 'no-cart') return NextResponse.json({ error: 'no-cart' }, { status: 409 });

    const result = await matchShoppingItems(userEmail, items, context.ctx, prefs);
    return NextResponse.json({
      ...result,
      context: {
        city: context.ctx.address.city,
        deliveryType: context.ctx.deliveryType,
        minOrderCost: context.ctx.minOrderCost,
      },
    });
  } catch (err) {
    return silpoErrorResponse(err);
  }
}
