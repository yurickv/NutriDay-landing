// app/api/subscription/init/route.ts
import { NextRequest, NextResponse } from 'next/server';

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

    // Ensure Mongo config exists
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB || 'nutridb';
    if (!uri) {
      return NextResponse.json(
        {
          success: false,
          message:
            'MongoDB not configured. Set MONGODB_URI (and optional MONGODB_DB).',
        },
        { status: 500 }
      );
    }

    // Import lazily to avoid build-time hard dependency
    const { MongoClient } = await import('mongodb');
    const client = await MongoClient.connect(uri);
    const db = client.db(dbName);
    const users = db.collection('users');

    // Find by email
    const existing = await users.findOne<{ paymentStatus?: string }>({ email });

    const now = new Date();
    if (!existing) {
      await users.insertOne({
        email,
        planId: planId || null,
        orderId: orderId || null,
        paymentStatus: 'pending',
        onboarding: onboardingData || {},
        createdAt: now,
        updatedAt: now,
      });
      return NextResponse.json({ success: true, status: 'pending-created' });
    }

    if (existing.paymentStatus === 'active') {
      return NextResponse.json({ success: true, status: 'active' });
    }

    await users.updateOne(
      { email },
      {
        $set: {
          planId: planId || null,
          orderId: orderId || null,
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

