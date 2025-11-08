// app/api/liqpay/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const base64 = (str: string) => Buffer.from(str).toString('base64');

export async function GET(request: NextRequest) {
  try {
    const publicKey = process.env.LIQPAY_PUBLIC_KEY;
    const privateKey = process.env.LIQPAY_PRIVATE_KEY;
    const mongoUri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB || 'nutridb';

    if (!publicKey || !privateKey) {
      return NextResponse.json(
        { success: false, message: 'LiqPay keys not configured' },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId') || searchParams.get('order_id') || searchParams.get('_order_id');
    if (!orderId) {
      return NextResponse.json(
        { success: false, message: 'Missing orderId' },
        { status: 400 }
      );
    }

    const payload: Record<string, any> = {
      action: 'status',
      version: '3',
      public_key: publicKey,
      order_id: orderId,
    };

    const data = base64(JSON.stringify(payload));
    const signature = crypto
      .createHash('sha1')
      .update(privateKey + data + privateKey)
      .digest('base64');

    // LiqPay expects form-encoded fields: data, signature
    const form = new URLSearchParams();
    form.set('data', data);
    form.set('signature', signature);
    const resp = await fetch('https://www.liqpay.ua/api/request', {
      method: 'POST',
      body: form,
    });

    if (!resp.ok) {
      const t = await resp.text();
      return NextResponse.json(
        { success: false, message: 'LiqPay status request failed', detail: t },
        { status: 502 }
      );
    }

    const liq = (await resp.json()) as any;
    const normalized = (liq?.status || '').toLowerCase();
    let updateTo: 'active' | 'failed' | null = null;
    if (normalized === 'success' || normalized === 'subscribed') updateTo = 'active';
    else if (['failure', 'reversed', 'cancelled', 'canceled'].includes(normalized)) updateTo = 'failed';

    if (mongoUri && updateTo) {
      const { MongoClient } = await import('mongodb');
      const client = await MongoClient.connect(mongoUri);
      const db = client.db(dbName);
      const users = db.collection('users');

      await users.updateOne(
        { orderId },
        {
          $set: {
            paymentStatus: updateTo,
            lastPayment: liq,
            updatedAt: new Date(),
          },
        }
      );

      await client.close();
    }

    return NextResponse.json({ success: true, liqpay: liq, updatedTo: updateTo || 'none' });
  } catch (error: any) {
    console.error('LiqPay status error:', error);
    return NextResponse.json(
      { success: false, message: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
