// app/api/liqpay/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit, getClientIp, tooManyRequestsResponse } from '@/lib/rateLimit';
import { PLANS, isPlanId } from '@/lib/plans';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

type CheckoutRequest = {
  description?: string;
  orderId: string;
  email?: string;
  language?: string; // default uk
  planId?: string;
  // NOTE: `amount`/`currency` are intentionally NOT read from the client.
  // The price is derived server-side from `planId` (see @/lib/plans) so a
  // tampered request cannot pay an arbitrary amount.
};

const base64 = (str: string) => Buffer.from(str).toString('base64');

// LiqPay's server→server `server_url` must be a public host. localhost/private
// addresses are unreachable from LiqPay and make checkout fail with `main_error`.
// In local/sandbox dev we simply omit it — subscription activation still works via
// the result page polling /api/liqpay/status (server-to-server).
function toPublicCallbackUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const host = new URL(url).hostname.toLowerCase();
    const isLocalOrPrivate =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.startsWith('192.168.') ||
      host.startsWith('10.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    return isLocalOrPrivate ? undefined : url;
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const perIp = await checkRateLimit(`checkout-ip:${ip}`, 20, WINDOW_MS);
    if (!perIp.allowed) return tooManyRequestsResponse(perIp.retryAfterSeconds);

    const body = (await request.json()) as CheckoutRequest;

    const publicKey = process.env.LIQPAY_PUBLIC_KEY;
    const privateKey = process.env.LIQPAY_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      return NextResponse.json(
        {
          success: false,
          message:
            'LiqPay keys are not configured. Set LIQPAY_PUBLIC_KEY and LIQPAY_PRIVATE_KEY.',
        },
        { status: 500 }
      );
    }

    const { description, orderId, email, language = 'uk', planId } = body;

    if (!isPlanId(planId)) {
      return NextResponse.json(
        { success: false, message: 'Unknown or missing planId' },
        { status: 400 }
      );
    }
    if (!orderId) {
      return NextResponse.json(
        { success: false, message: 'orderId is required' },
        { status: 400 }
      );
    }

    // Server-authoritative price: never trust a client-supplied amount.
    const plan = PLANS[planId];
    const amount = plan.amount;
    const currency = plan.currency;
    const safeDescription =
      typeof description === 'string' && description.trim() ? description.trim() : plan.title;

    // Build LiqPay payload (v3)
    const payload: Record<string, any> = {
      public_key: publicKey,
      version: '3',
      action: 'pay',
      amount,
      currency,
      description: safeDescription,
      order_id: orderId,
      language,
      // If provided, many LiqPay accounts accept sender email as a meta field
      // Some integrations use `sender_email` or `customer` – include both for safety.
      sender_email: email,
      customer: email,
      // Control payment options visibility. If LiqPay ignores unknown keys, it’s safe.
      paytypes: 'card,gpay,apay,privat24',
      // Optional URLs – can be configured via env
      result_url:
        process.env.NEXT_PUBLIC_LIQPAY_RESULT_URL || process.env.LIQPAY_RESULT_URL,
      server_url: toPublicCallbackUrl(process.env.LIQPAY_SERVER_URL),
      // Pass plan id for your own bookkeeping
      info: planId,
      // For sandbox testing set via env
      sandbox: process.env.LIQPAY_SANDBOX === '1' ? 1 : undefined,
    };

    // Clean undefined values to avoid LiqPay rejecting payload
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    const data = base64(JSON.stringify(payload));
    const signature = crypto
      .createHash('sha1')
      .update(privateKey + data + privateKey)
      .digest('base64');

    return NextResponse.json({ success: true, data, signature });
  } catch (error) {
    console.error('LiqPay checkout error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create LiqPay checkout' },
      { status: 500 }
    );
  }
}
