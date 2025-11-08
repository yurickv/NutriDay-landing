// app/api/subscription/status/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB || 'nutridb';
    if (!uri) {
      return NextResponse.json(
        { success: false, message: 'MongoDB not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId') || searchParams.get('order_id') || searchParams.get('_order_id');
    const email = searchParams.get('email') || undefined;

    if (!orderId && !email) {
      return NextResponse.json(
        { success: false, message: 'Provide orderId or email' },
        { status: 400 }
      );
    }

    const { MongoClient } = await import('mongodb');
    const client = await MongoClient.connect(uri);
    const db = client.db(dbName);
    const users = db.collection('users');

    const doc = await users.findOne({
      ...(orderId ? { orderId } : {}),
      ...(email ? { email } : {}),
    });

    await client.close();

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
    });
  } catch (error: any) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}

