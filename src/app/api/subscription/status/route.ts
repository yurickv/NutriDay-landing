// app/api/subscription/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId =
      searchParams.get('orderId') ||
      searchParams.get('order_id') ||
      searchParams.get('_order_id');
    const email = searchParams.get('email') || undefined;

    if (!orderId && !email) {
      return NextResponse.json(
        { success: false, message: 'Provide orderId or email' },
        { status: 400 }
      );
    }

    const db = await getDb();
    const users = db.collection('users');

    const doc = await users.findOne({
      ...(orderId ? { orderId } : {}),
      ...(email ? { email } : {}),
    });

    if (!doc) {
      return NextResponse.json({ success: true, found: false });
    }

    return NextResponse.json({
      success: true,
      found: true,
      email: (doc as any).email,
      orderId: (doc as any).orderId,
      planId: (doc as any).planId,
      paymentStatus: (doc as any).paymentStatus,
      status: (doc as any).status ?? null,
    });
  } catch (error: any) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}

