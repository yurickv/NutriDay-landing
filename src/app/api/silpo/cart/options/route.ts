import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { lookupDeliveryOptions } from '@/lib/silpo/setupCart';
import { silpoErrorResponse } from '@/lib/silpo/apiErrors';

// Vercel Hobby max: geocoding + delivery types + full branch list (500 rows).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { address?: unknown };
  const address = typeof body.address === 'string' ? body.address.trim().slice(0, 200) : '';
  if (address.length < 3) return NextResponse.json({ error: 'address required' }, { status: 400 });

  try {
    return NextResponse.json(await lookupDeliveryOptions(userEmail, address));
  } catch (err) {
    return silpoErrorResponse(err);
  }
}
