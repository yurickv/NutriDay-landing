// app/api/subscription/init/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hasActiveSubscription } from '@/lib/subscription';

type PlanId = 'week' | 'month';

interface InitSubscriptionBody {
  email?: string;
  onboardingData?: Record<string, any>;
  planId?: PlanId;
  orderId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as InitSubscriptionBody;
    const { email, onboardingData, planId, orderId } = body || {};

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, message: 'Invalid or missing email' },
        { status: 400 }
      );
    }

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

