import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { ShoppingListItem } from '@/types/shoppingList';
import crypto from 'crypto';

export async function GET() {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = await getDb();
  const list = await db.collection('shopping_lists').findOne(
    { userEmail },
    { sort: { weekStartDate: -1 } },
  );

  return NextResponse.json({ list: list ?? null });
}

export async function PATCH(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { itemId: string; isPurchased: boolean };
  const { itemId, isPurchased } = body;

  if (!itemId) {
    return NextResponse.json({ error: 'itemId required' }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.collection('shopping_lists').updateOne(
    { userEmail, 'items.id': itemId },
    {
      $set: {
        'items.$.isPurchased': isPurchased,
        'items.$.purchasedAt': isPurchased ? new Date() : null,
        updatedAt: new Date(),
      },
    },
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { name?: string; quantity?: number; unit?: string };
  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: 'Name required' }, { status: 400 });
  }

  const db = await getDb();
  const list = await db.collection('shopping_lists').findOne(
    { userEmail },
    { sort: { weekStartDate: -1 } },
  );

  if (!list) {
    return NextResponse.json({ error: 'No shopping list found' }, { status: 404 });
  }

  const newItem: ShoppingListItem = {
    id: crypto.randomUUID(),
    name: name.charAt(0).toUpperCase() + name.slice(1),
    quantity: body.quantity ?? 1,
    unit: body.unit ?? 'шт',
    shoppingCategory: 'other',
    mealNames: [],
    forDays: [],
    isPurchased: false,
    purchasedAt: null,
    isCustom: true,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db.collection('shopping_lists') as any).updateOne(
    { _id: list._id },
    {
      $push: { items: newItem },
      $set: { updatedAt: new Date() },
    },
  );

  return NextResponse.json({ success: true, item: newItem });
}
