// app/api/auth/magic-link/consume/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { consumeMagicLinkToken } from '@/lib/auth/magic';
import { createSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db';

const base64 = (str: string) => Buffer.from(str).toString('base64');

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      const url = new URL('/auth/login?e=missing_token', req.url);
      return NextResponse.redirect(url);
    }

    const user: any = await consumeMagicLinkToken(token);
    if (!user || !user.email) {
      const url = new URL('/auth/login?e=invalid_or_expired', req.url);
      return NextResponse.redirect(url);
    }

    const db = await getDb();
    let latestUser = await db.collection('users').findOne<any>({ email: user.email });

    let paymentStatus = (latestUser?.paymentStatus || '').toLowerCase();

    // Якщо ще немає активної оплати, спробувати оновити статус через LiqPay
    if (paymentStatus !== 'active' && latestUser?.orderId) {
      const publicKey = process.env.LIQPAY_PUBLIC_KEY;
      const privateKey = process.env.LIQPAY_PRIVATE_KEY;

      if (publicKey && privateKey) {
        try {
          const payload: Record<string, any> = {
            action: 'status',
            version: '3',
            public_key: publicKey,
            order_id: latestUser.orderId,
          };

          const data = base64(JSON.stringify(payload));
          const signature = crypto
            .createHash('sha1')
            .update(privateKey + data + privateKey)
            .digest('base64');

          const form = new URLSearchParams();
          form.set('data', data);
          form.set('signature', signature);

          const resp = await fetch('https://www.liqpay.ua/api/request', {
            method: 'POST',
            body: form,
          });

          if (resp.ok) {
            const liq = (await resp.json()) as any;
            const normalized = (liq?.status || '').toLowerCase();
            let updateTo: 'active' | 'failed' | null = null;
            if (['success', 'subscribed', 'sandbox'].includes(normalized))
              updateTo = 'active';
            else if (
              ['failure', 'reversed', 'cancelled', 'canceled'].includes(
                normalized
              )
            )
              updateTo = 'failed';

            if (updateTo) {
              await db.collection('users').updateOne(
                { email: user.email },
                {
                  $set: {
                    paymentStatus: updateTo,
                    lastPayment: liq,
                    updatedAt: new Date(),
                  },
                }
              );
              paymentStatus = updateTo;
            }
          }
        } catch (err) {
          console.error('LiqPay status check from magic-link failed:', err);
        }
      }

      // перечитати користувача після можливого оновлення
      latestUser = await db.collection('users').findOne({ email: user.email });
    }

    await createSession(String(user.email));

    if ((paymentStatus || '').toLowerCase() === 'active') {
      const redirectUrl = new URL('/menu', req.url);
      return NextResponse.redirect(redirectUrl);
    }

    const fallbackUrl = new URL('/payment/result', req.url);
    if (latestUser?.orderId) {
      fallbackUrl.searchParams.set('order_id', String(latestUser.orderId));
      if (paymentStatus) {
        fallbackUrl.searchParams.set('status', paymentStatus);
      }
    }
    return NextResponse.redirect(fallbackUrl);
  } catch (error: any) {
    console.error('Magic-link consume error:', error);
    const url = new URL('/auth/login?e=server_error', req.url);
    return NextResponse.redirect(url);
  }
}

