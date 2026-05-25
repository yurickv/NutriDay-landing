// app/api/auth/magic-link/consume/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { consumeMagicLinkToken } from '@/lib/auth/magic';
import { createSession } from '@/lib/auth/session';
import { getDb } from '@/lib/db';
import { computeSubscriptionExpiry, checkSessionSubscription, inactiveRedirectTarget } from '@/lib/subscription';

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
        // Normalize sex: "Чоловік" (Ukrainian from CaloriesCalcList) → "male"
        const rawSex = String(od.sex ?? '');
        const sex = (rawSex === 'Чоловік' || rawSex === 'male') ? 'male' : 'female';
        const activityLevel = parseFloat(od.activity ?? '1.375');

        const bmr = sex === 'male'
          ? Math.round(10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5)
          : Math.round(10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161);
        const tdee = Math.round(bmr * activityLevel);
        const minCalories = sex === 'male' ? 1500 : 1200;
        const goalCalories = Math.max(minCalories, tdee - 500);

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
      const redirectUrl = new URL('/menu', req.url);
      return NextResponse.redirect(redirectUrl);
    }

    // No valid subscription: returning user → payment page, unknown user → onboarding.
    return NextResponse.redirect(new URL(inactiveRedirectTarget(userExists), req.url));
  } catch (error: any) {
    console.error('Magic-link consume error:', error);
    const url = new URL('/auth/login?e=server_error', req.url);
    return NextResponse.redirect(url);
  }
}

