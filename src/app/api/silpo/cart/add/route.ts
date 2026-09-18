import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { callTool } from '@/lib/silpo/client';
import { getCartRaw, resolveCartContext } from '@/lib/silpo/cartContext';
import { silpoErrorResponse } from '@/lib/silpo/apiErrors';
import { SilpoAddResult } from '@/lib/silpo/types';
import { getDb } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { ShoppingListItem, SilpoCartTag } from '@/types/shoppingList';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PRODUCTS = 60;

// Vercel Hobby max: cart context + add + re-read is several sequential Silpo calls.
export const maxDuration = 60;

interface ProductInput {
  productId: string;
  companyId: string;
  branchId: string;
  quantity: number;
  /** Our shopping-list item this product was matched for (tagged after a successful add). */
  itemId?: string;
  productName?: string;
}

function isProduct(v: unknown): v is ProductInput {
  const p = v as ProductInput;
  return !!p && UUID.test(p.productId) && UUID.test(p.companyId) && UUID.test(p.branchId)
    && typeof p.quantity === 'number' && p.quantity > 0
    && (p.itemId === undefined || typeof p.itemId === 'string')
    && (p.productName === undefined || typeof p.productName === 'string');
}

/** Remember on each list item that it now sits in the user's Silpo cart. */
async function tagListItems(userEmail: string, products: ProductInput[]): Promise<void> {
  const tagged = products.filter((p) => p.itemId);
  if (tagged.length === 0) return;
  const db = await getDb();
  const list = await db.collection('shopping_lists').findOne<{ _id: ObjectId; items: ShoppingListItem[] }>(
    { userEmail }, { sort: { weekStartDate: -1 } },
  );
  if (!list) return;
  const known = new Set(list.items.map((i) => i.id));
  const now = new Date();
  for (const p of tagged) {
    if (!known.has(p.itemId as string)) continue;
    const tag: SilpoCartTag = {
      productId: p.productId, productName: (p.productName ?? '').slice(0, 200), quantity: p.quantity, addedAt: now,
    };
    await db.collection('shopping_lists').updateOne(
      { _id: list._id, 'items.id': p.itemId },
      { $set: { 'items.$.silpo': tag, updatedAt: now } },
    );
  }
}

export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { products?: unknown[] };
  const products = (Array.isArray(body.products) ? body.products : []).filter(isProduct).slice(0, MAX_PRODUCTS);
  if (products.length === 0) return NextResponse.json({ error: 'products required' }, { status: 400 });

  try {
    const context = await resolveCartContext(userEmail);
    if (context.kind === 'no-cart') return NextResponse.json({ error: 'no-cart' }, { status: 409 });

    await callTool(userEmail, 'silpo_add_or_update_cart_products', {
      shoppingCartId: context.ctx.cartId,
      products: products.map((p) => ({
        productId: p.productId,
        companyId: p.companyId,
        branchId: p.branchId,
        quantity: p.quantity,
      })),
    });

    await tagListItems(userEmail, products);

    const cart = await getCartRaw(userEmail, context.ctx.cartId);
    const result: SilpoAddResult = {
      totalAfterDiscounts: cart.calculation?.totalAfterDiscounts ?? 0,
      minOrderCost: context.ctx.minOrderCost,
      validations: cart.calculation?.validations ?? [],
      checkoutWebLink: cart.checkoutWebLink ?? null,
      checkoutMobileLink: cart.checkoutMobileLink ?? null,
    };
    return NextResponse.json(result);
  } catch (err) {
    return silpoErrorResponse(err);
  }
}
