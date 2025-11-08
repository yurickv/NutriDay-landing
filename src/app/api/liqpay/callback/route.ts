// app/api/liqpay/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

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

export async function POST(request: NextRequest) {
  try {
    const privateKey = process.env.LIQPAY_PRIVATE_KEY;
    const mongoUri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB || 'nutridb';

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
    if (expected !== signature) {
      return NextResponse.json(
        { success: false, message: 'Invalid signature' },
        { status: 400 }
      );
    }

    const payload = decodeBase64Json(data);
    const { order_id: orderId, status, email, sender_email: senderEmail } = payload;

    // Optionally persist to Mongo
    if (mongoUri) {
      const { MongoClient } = await import('mongodb');
      const client = await MongoClient.connect(mongoUri);
      const db = client.db(dbName);
      const users = db.collection('users');

      // Determine new payment status
      let newStatus: 'active' | 'pending' | 'failed' = 'pending';
      const normalized = (status || '').toLowerCase();
      if (['success', 'subscribed', 'sandbox'].includes(normalized)) newStatus = 'active';
      else if (['failure', 'error', 'reversed', 'cancelled', 'canceled'].includes(normalized)) newStatus = 'failed';

      const now = new Date();
      const matcher = orderId ? { orderId } : { email: email || senderEmail };

      await users.updateOne(
        matcher,
        {
          $set: {
            paymentStatus: newStatus,
            lastPayment: payload,
            updatedAt: now,
          },
        },
        { upsert: false }
      );

      await client.close();
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('LiqPay callback error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
