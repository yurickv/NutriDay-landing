import { NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { isSilpoEnabled } from '@/lib/silpo/oauth';
import { getConnection } from '@/lib/silpo/connections';
import { getCartSummary } from '@/lib/silpo/cartContext';
import { SilpoAuthError } from '@/lib/silpo/types';

// Vercel Hobby max: two Silpo calls for the cart summary.
export const maxDuration = 30;

export async function GET() {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const enabled = isSilpoEnabled();
  if (!enabled) return NextResponse.json({ enabled, connected: false, status: null, cart: null });

  const conn = await getConnection(userEmail);
  if (!conn) return NextResponse.json({ enabled, connected: false, status: null, cart: null });
  if (conn.status === 'expired') return NextResponse.json({ enabled, connected: false, status: 'expired', cart: null });

  try {
    const cart = await getCartSummary(userEmail);
    return NextResponse.json({ enabled, connected: true, status: 'active', cart });
  } catch (err) {
    if (err instanceof SilpoAuthError) {
      return NextResponse.json({ enabled, connected: false, status: 'expired', cart: null });
    }
    // Cart lookup is best-effort; the connection itself is fine.
    return NextResponse.json({ enabled, connected: true, status: 'active', cart: null });
  }
}
