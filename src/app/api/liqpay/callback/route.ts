// app/api/liqpay/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb } from '@/lib/db';
import { issueMagicLinkToken } from '@/lib/auth/magic';
import { sendMagicLinkEmail } from '@/lib/email';
import { computeSubscriptionExpiry } from '@/lib/subscription';
import { PLANS, isPlanId } from '@/lib/plans';
import { capturePaymentEvent } from '@/lib/analytics/posthog.server';

type LiqpayCallback = {
  order_id?: string;
  status?: string;
  email?: string;
  sender_email?: string;
  info?: string; // planId
  amount?: number;
  currency?: string;
  [k: string]: any;
};

const decodeBase64Json = (b64: string) => {
  const json = Buffer.from(b64, 'base64').toString('utf8');
  return JSON.parse(json) as LiqpayCallback;
};

const buildSignature = (privateKey: string, data: string) =>
  crypto.createHash('sha1').update(privateKey + data + privateKey).digest('base64');

// Constant-time compare so signature validation doesn't leak via response timing.
const signaturesMatch = (expected: string, received: string): boolean => {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

export async function POST(request: NextRequest) {
  try {
    const privateKey = process.env.LIQPAY_PRIVATE_KEY;

    if (!privateKey) {
      return NextResponse.json(
        { success: false, message: 'LiqPay private key is not configured' },
        { status: 500 }
      );
    }

    // LiqPay posts as form-url-encoded: data, signature
    let data: string | null = null;
    let signature: string | null = null;

    // Try form first
    try {
      const form = await request.formData();
      data = (form.get('data') as string) || null;
      signature = (form.get('signature') as string) || null;
    } catch (_) {
      // ignore, fall back to JSON
    }

    if (!data || !signature) {
      try {
        const body = (await request.json()) as { data?: string; signature?: string };
        data = body?.data || null;
        signature = body?.signature || null;
      } catch (_) {}
    }

    if (!data || !signature) {
      return NextResponse.json(
        { success: false, message: 'Missing data/signature' },
        { status: 400 }
      );
    }

    const expected = buildSignature(privateKey, data);
    if (!signaturesMatch(expected, signature)) {
      return NextResponse.json(
        { success: false, message: 'Invalid signature' },
        { status: 400 }
      );
    }

    const payload = decodeBase64Json(data);
    const {
      order_id: orderId,
      status,
      email,
      sender_email: senderEmail,
      info: planId,
    } = payload;

    const db = await getDb();
    const users = db.collection('users');
    const subs = db.collection('subscriptions');

    // Idempotency + audit log. LiqPay retries webhooks; identical callbacks
    // share the same signature, so the unique index on `signature` both
    // deduplicates retries and serialises concurrent races (only one insert
    // wins; the rest get a duplicate-key error and exit before any side effect
    // such as sending a magic-link email).
    try {
      await db.collection('payment_events').insertOne({
        signature,
        orderId: orderId ?? null,
        status: status ?? null,
        payload,
        createdAt: new Date(),
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        return NextResponse.json({ success: true, duplicate: true });
      }
      throw err;
    }

    // Determine new payment status
    let paymentStatus: 'active' | 'pending' | 'failed' = 'pending';
    const normalized = (status || '').toLowerCase();
    if (['success', 'subscribed', 'sandbox'].includes(normalized)) paymentStatus = 'active';
    else if (['failure', 'error', 'reversed', 'cancelled', 'canceled'].includes(normalized)) paymentStatus = 'failed';

    const now = new Date();
    const matcher = orderId ? { orderId } : { email: email || senderEmail };

    const user = await users.findOne(matcher);
    if (user) {
      const previousPaymentStatus = (user as any).paymentStatus;
      const effectivePlanId = planId || (user as any).planId || null;

      // Defense in depth against price tampering: if the (LiqPay-signed) amount
      // is below the plan's server-side price, refuse to activate. With the
      // checkout route now forcing the correct amount this should never trigger
      // for a legitimate flow; it catches anything that bypasses checkout.
      if (paymentStatus === 'active' && isPlanId(effectivePlanId)) {
        const expectedAmount = PLANS[effectivePlanId].amount;
        const paidAmount = Number((payload as any).amount);
        if (Number.isFinite(paidAmount) && paidAmount + 0.01 < expectedAmount) {
          console.error(
            `LiqPay amount mismatch: paid ${paidAmount} < expected ${expectedAmount} for plan ${effectivePlanId} (order ${orderId ?? 'n/a'})`,
          );
          paymentStatus = 'failed';
        }
      }

      const expiresAt =
        paymentStatus === 'active' ? computeSubscriptionExpiry(effectivePlanId, now) : null;

      await users.updateOne(
        { _id: user._id },
        {
          $set: {
            paymentStatus,
            status: paymentStatus === 'active' ? 'paid' : (user as any).status || 'pending',
            lastPayment: payload,
            updatedAt: now,
            planId: effectivePlanId,
            ...(paymentStatus === 'active' ? { subscriptionExpiresAt: expiresAt } : {}),
          },
        }
      );

      if (paymentStatus === 'active') {
        await subs.updateOne(
          { userId: user._id },
          {
            $set: {
              userId: user._id,
              planId: effectivePlanId,
              status: 'active',
              expiresAt,
              updatedAt: now,
            },
            $setOnInsert: {
              createdAt: now,
            },
          },
          { upsert: true }
        );

        if (previousPaymentStatus !== 'active') {
          const loginEmail = (user as any).email || email || senderEmail;
          if (loginEmail) {
            const { token } = await issueMagicLinkToken(loginEmail);
            await sendMagicLinkEmail(loginEmail, token);

            await capturePaymentEvent({
              email: String(loginEmail).trim().toLowerCase(),
              event: 'payment_succeeded',
              orderId: orderId ?? '',
              plan: effectivePlanId,
              amount: isPlanId(effectivePlanId) ? PLANS[effectivePlanId].amount : undefined,
              currency: isPlanId(effectivePlanId) ? PLANS[effectivePlanId].currency : undefined,
              utmSource: (user as any).utmSource ?? null,
            });
          }
        }
      }
    }

    if (user && paymentStatus === 'failed' && (user as any).paymentStatus !== 'failed') {
      const failEmail = (user as any).email || email || senderEmail;
      if (failEmail) {
        await capturePaymentEvent({
          email: String(failEmail).trim().toLowerCase(),
          event: 'payment_failed',
          orderId: orderId ?? '',
          status: status ?? undefined,
          utmSource: (user as any).utmSource ?? null,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('LiqPay callback error:', error);
    return NextResponse.json(
      { success: false, message: 'Server error' },
      { status: 500 }
    );
  }
}

