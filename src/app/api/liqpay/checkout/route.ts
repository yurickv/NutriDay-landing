// app/api/liqpay/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

type CheckoutRequest = {
  amount: number;
  description: string;
  orderId: string;
  currency?: string; // default UAH
  email?: string;
  language?: string; // default uk
  planId?: string;
};

const base64 = (str: string) => Buffer.from(str).toString('base64');

export async function POST(request: NextRequest) {
  try {
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

    const {
      amount,
      description,
      orderId,
      currency = 'UAH',
      email,
      language = 'uk',
      planId,
    } = body;

    if (!amount || !description || !orderId) {
      return NextResponse.json(
        { success: false, message: 'amount, description and orderId are required' },
        { status: 400 }
      );
    }

    // Build LiqPay payload (v3)
    const payload: Record<string, any> = {
      public_key: publicKey,
      version: '3',
      action: 'pay',
      amount,
      currency,
      description,
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
      server_url: process.env.LIQPAY_SERVER_URL,
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
