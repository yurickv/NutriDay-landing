// app/api/auth/magic-link/consume/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { consumeMagicLinkToken } from '@/lib/auth/magic';
import { createSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { computeSubscriptionExpiry, checkSessionSubscription, inactiveRedirectTarget } from '@/lib/subscription';
import { calcCalories, normalizeSex } from '@/lib/calories';

const base64 = (str: string) => Buffer.from(str).toString('base64');

type ConsumeResult =
  | { ok: true; redirect: string; email: string }
  | { ok: false; error: string };

// Consumes the one-time token, reconciles payment status, creates the session,
// auto-initialises the profile, and resolves where the user should land.
// Shared by the POST handler (the real entry point) so the heavy logic lives in
// one place. The session cookie is set via createSession() in the calling
// request context.
async function processMagicToken(token: string): Promise<ConsumeResult> {
  const user: any = await consumeMagicLinkToken(token);
  if (!user || !user.email) {
    return { ok: false, error: 'invalid_or_expired' };
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
            ['failure', 'reversed', 'cancelled', 'canceled'].includes(normalized)
          )
            updateTo = 'failed';

          if (updateTo) {
            const now = new Date();
            await db.collection('users').updateOne(
              { email: user.email },
              {
                $set: {
                  paymentStatus: updateTo,
                  lastPayment: liq,
                  updatedAt: now,
                  ...(updateTo === 'active'
                    ? { subscriptionExpiresAt: computeSubscriptionExpiry(latestUser?.planId ?? null, now) }
                    : {}),
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

  // Auto-initialize user_profiles from onboarding data (runs once on first login)
  try {
    const profileCol = db.collection('user_profiles');
    const existingProfile = await profileCol.findOne({ userEmail: user.email });
    if (!existingProfile && latestUser?.onboarding) {
      const od = latestUser.onboarding as Record<string, string>;
      const weightKg = parseFloat(od.weight ?? '60');
      const heightCm = parseFloat(od.height ?? '165');
      const ageYears = parseInt(od.age ?? '25', 10);
      const sex = normalizeSex(od.sex);
      const activityLevel = parseFloat(od.activity ?? '1.375');

      const { bmr, tdee, goalCalories } = calcCalories({
        weightKg,
        heightCm,
        ageYears,
        sex,
        activityLevel,
        mainGoal: od.mainGoal,
      });

      await profileCol.insertOne({
        userEmail: String(user.email),
        sex,
        age: od.age,
        weight: od.weight,
        height: od.height,
        activity: od.activity,
        weightKg,
        heightCm,
        ageYears,
        activityLevel,
        bmr,
        tdee,
        goalCalories,
        favoriteFoods: [],
        dislikedFoods: [],
        dietaryPreferences: [],
        allergies: [],
        waterGoalMl: 2000,
        menuGenerationsThisWeek: 0,
        lastGenerationWeekStart: null,
        mainGoal: od.mainGoal,
        updatedAt: new Date(),
      } as any);
    }
  } catch (profileErr) {
    console.error('Failed to auto-create user_profiles:', profileErr);
  }

  // Grant access only if the subscription is active AND not expired
  // (checkSessionSubscription also backfills expiry for legacy paid users).
  const { active: subscriptionActive, userExists } = await checkSessionSubscription();
  if (subscriptionActive) {
    return { ok: true, redirect: '/menu', email: String(user.email) };
  }

  // No valid subscription: returning user → payment page, unknown user → onboarding.
  return { ok: true, redirect: inactiveRedirectTarget(userExists), email: String(user.email) };
}

// POST is the real entry point: the confirmation page sends the token in the
// body when the user explicitly clicks "Підтвердити вхід". Returns JSON with the
// redirect target; the session cookie is set as a side effect.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { token?: string };
    const token = body?.token;
    if (!token) {
      return NextResponse.json({ success: false, error: 'missing_token' }, { status: 400 });
    }

    const result = await processMagicToken(token);
    if (!result.ok) {
      return NextResponse.json({ success: false, error: result.error }, { status: 401 });
    }

    return NextResponse.json({ success: true, redirect: result.redirect, email: result.email });
  } catch (error: any) {
    console.error('Magic-link consume error:', error);
    return NextResponse.json({ success: false, error: 'server_error' }, { status: 500 });
  }
}

// GET no longer consumes the token (that would let prefetchers spend it).
// It just forwards to the confirmation page, which keeps older emails that
// still link to this API endpoint working.
export function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/auth/login?e=missing_token', req.url));
  }
  return NextResponse.redirect(
    new URL(`/auth/confirm?token=${encodeURIComponent(token)}`, req.url)
  );
}
