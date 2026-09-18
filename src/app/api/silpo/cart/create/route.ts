import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { createCart, DeliveryOption, ResolvedAddress } from '@/lib/silpo/setupCart';
import { getCartSummary } from '@/lib/silpo/cartContext';
import { silpoErrorResponse } from '@/lib/silpo/apiErrors';

// Vercel Hobby max: time slots + create cart + re-read summary.
export const maxDuration = 60;

function isAddress(v: unknown): v is ResolvedAddress {
  const a = v as ResolvedAddress;
  return !!a && typeof a.latitude === 'number' && typeof a.longitude === 'number';
}

function isOption(v: unknown): v is DeliveryOption {
  const o = v as DeliveryOption;
  return !!o && (o.deliveryType === 'DeliveryHome' || o.deliveryType === 'SelfPickup') && typeof o.branchId === 'string';
}

export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { address?: unknown; option?: unknown };
  if (!isAddress(body.address) || !isOption(body.option)) {
    return NextResponse.json({ error: 'address and option required' }, { status: 400 });
  }

  try {
    await createCart(userEmail, body.address, body.option);
    const cart = await getCartSummary(userEmail);
    return NextResponse.json({ cart });
  } catch (err) {
    return silpoErrorResponse(err);
  }
}
