import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { callTool } from '@/lib/silpo/client';
import { getCartRaw, resolveCartContext } from '@/lib/silpo/cartContext';
import { silpoErrorResponse } from '@/lib/silpo/apiErrors';
import { SilpoAddResult } from '@/lib/silpo/types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PRODUCTS = 60;

interface ProductInput { productId: string; companyId: string; branchId: string; quantity: number }

function isProduct(v: unknown): v is ProductInput {
  const p = v as ProductInput;
  return !!p && UUID.test(p.productId) && UUID.test(p.companyId) && UUID.test(p.branchId)
    && typeof p.quantity === 'number' && p.quantity > 0;
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
