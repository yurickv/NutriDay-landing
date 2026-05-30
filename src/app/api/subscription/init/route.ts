// app/api/subscription/init/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hasActiveSubscription } from '@/lib/subscription';
import { readSessionUserId } from '@/lib/auth/session';
import { checkRateLimit, getClientIp, tooManyRequestsResponse } from '@/lib/rateLimit';

type PlanId = 'week' | 'month';

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface InitSubscriptionBody {
  email?: string;
  onboardingData?: Record<string, any>;
  planId?: PlanId;
  orderId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as InitSubscriptionBody;
    const { onboardingData, planId, orderId } = body || {};

    // Prefer the authenticated session email when present (e.g. an expired
    // subscriber re-paying) so a logged-in user can never write to another
    // account; new users in the onboarding/payment flow have no session yet
    // and fall back to the email from the request body.
    const sessionEmail = await readSessionUserId();
    const email = (sessionEmail || body?.email || '').trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Invalid or missing email' },
        { status: 400 }
      );
    }

    const ip = getClientIp(request);
    const perEmail = await checkRateLimit(`init:${ip}:${email}`, 10, WINDOW_MS);
    if (!perEmail.allowed) return tooManyRequestsResponse(perEmail.retryAfterSeconds);
    const perIp = await checkRateLimit(`init-ip:${ip}`, 30, WINDOW_MS);
    if (!perIp.allowed) return tooManyRequestsResponse(perIp.retryAfterSeconds);

    const db = await getDb();
    const users = db.collection('users');

    const now = new Date();
    const existing = await users.findOne<{ paymentStatus?: string; subscriptionExpiresAt?: Date }>({ email });

    if (!existing) {
      // Shadow account: pending user, payment pending until LiqPay webhook
      await users.insertOne({
        email,
        planId: planId || null,
        orderId: orderId || null,
        status: 'pending',
        paymentStatus: 'pending',
        onboarding: onboardingData || {},
        createdAt: now,
        updatedAt: now,
      });
      return NextResponse.json({ success: true, status: 'pending-created' });
    }

    // Only short-circuit to /menu if the subscription is genuinely still valid.
    // An expired (paymentStatus 'active' but past expiry) user must be able to pay again.
    if (hasActiveSubscription(existing)) {
      return NextResponse.json({ success: true, status: 'active' });
    }

    await users.updateOne(
      { email },
      {
        $set: {
          planId: planId || null,
          orderId: orderId || null,
          status: 'pending',
          paymentStatus: 'pending',
          onboarding: onboardingData || {},
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({ success: true, status: 'pending-updated' });
  } catch (error: any) {
    console.error('Init subscription error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}

