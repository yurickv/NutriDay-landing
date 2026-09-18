import { NextRequest, NextResponse } from 'next/server';
import { readSessionUserId } from '@/lib/auth/session';
import { callTool } from '@/lib/silpo/client';
import { normalizeProductDetails } from '@/lib/silpo/productDetails';
import { silpoErrorResponse } from '@/lib/silpo/apiErrors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{1,150}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

// One Silpo call; the client passes the cart context it already got from /match
// (branch + delivery type + timeslot) so we don't re-resolve the cart here.
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const userEmail = await readSessionUserId();
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = req.nextUrl.searchParams;
  const slug = q.get('slug') ?? '';
  const branchId = q.get('branchId') ?? '';
  const deliveryType = q.get('deliveryType') ?? '';
  const timeslotStart = q.get('timeslotStart') ?? '';
  const timeslotEnd = q.get('timeslotEnd') ?? '';
  if (!SLUG.test(slug) || !UUID.test(branchId) || !/^[A-Za-z]{3,40}$/.test(deliveryType)
    || !ISO.test(timeslotStart) || !ISO.test(timeslotEnd)) {
    return NextResponse.json({ error: 'invalid params' }, { status: 400 });
  }

  try {
    const raw = await callTool<unknown>(userEmail, 'silpo_get_product_details', {
      branchId, slug, deliveryType, timeslotStart, timeslotEnd,
    });
    return NextResponse.json({ details: normalizeProductDetails(raw) });
  } catch (err) {
    return silpoErrorResponse(err);
  }
}
