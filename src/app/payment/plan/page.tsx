// app/payment/plan/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import ExampleWorkSection from '@/components/MainPage/section-exampleWork/ExampleWorkSection';
import {
  getOnboardingData,
  setOnboardingData,
} from '@/utils/onboardingHelpers';
import type { OnboardingData } from '@/types/onboarding';
import { Check } from 'lucide-react';
import { PLANS, isPlanId, type PlanId } from '@/lib/plans';
import { track, identify } from '@/lib/analytics';
import { readAttribution } from '@/lib/analytics/attribution';
import { labelFor } from '@/lib/onboarding/steps';

// Prices come from @/lib/plans (server source of truth). The amount sent to
// checkout is derived server-side from planId, so the values here are display-only.

function countdownParts(ms: number): { mm: string; ss: string } {
  return {
    mm: String(Math.floor(ms / 60000)).padStart(2, '0'),
    ss: String(Math.floor(ms / 1000) % 60).padStart(2, '0'),
  };
}

function goalHeadline(data: OnboardingData) {
  const map: Record<string, string> = {
    lose_weight: 'здорового схуднення',
    build_muscle: 'набору м’язової маси',
    gain_weight: 'здорового набору ваги',
  };
  return map[data.mainGoal || ''] || 'ваших цілей';
}

type DiscountState = { active: boolean; until: number | null };

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<OnboardingData>({});
  const [email, setEmail] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('month');
  // Вікно знижки: джерело правди — httpOnly-кука (GET /api/discount);
  // тут лише відображення таймера. Ціну оплати сервер рахує сам.
  const [discount, setDiscount] = useState<DiscountState | null>(null);
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending'>(
    'idle'
  );
  // Згоди зібрані раніше у квізі: оферта — чекбокс на першому кроці (gender),
  // персональні дані — на кроці your_profile (D2). Тут їх більше не питаємо.
  const emailEnteredFired = React.useRef(false);
  const paySectionRef = React.useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = getOnboardingData();
    setData(d);
    if ((d as any).email) setEmail((d as any).email);

    // Prefill from the DB record for returning/logged-in users (localStorage wins
    // when it has a value, so a fresh onboarding isn't overwritten).
    let cancelled = false;
    fetch('/api/subscription/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((acc: { email?: string | null; planId?: string | null; onboarding?: OnboardingData } | null) => {
        if (cancelled || !acc || !acc.email) return;
        if (acc.onboarding) {
          setData((prev) => ({ ...(acc.onboarding as OnboardingData), ...prev }));
        }
        setEmail((prev) => prev || acc.email || '');
        if (isPlanId(acc.planId)) {
          setSelectedPlan(acc.planId);
        }
      })
      .catch(() => {});

    fetch('/api/discount')
      .then((res) => (res.ok ? res.json() : null))
      .then((s: DiscountState | null) => {
        if (!cancelled) setDiscount(s ?? { active: false, until: null });
      })
      .catch(() => !cancelled && setDiscount({ active: false, until: null }));

    return () => {
      cancelled = true;
    };
  }, []);

  // Секундний тик таймера, поки знижка активна.
  useEffect(() => {
    if (!discount?.active) return;
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [discount?.active]);

  const remainingMs =
    discount?.active && discount.until ? Math.max(0, discount.until - nowTs) : 0;
  const discountActive = discount?.active === true && remainingMs > 0;

  // Таймер дійшов нуля — вікно згоріло, показуємо повні ціни.
  useEffect(() => {
    if (discount?.active && remainingMs === 0) {
      setDiscount({ active: false, until: discount.until });
    }
  }, [discount, remainingMs]);

  // Persist email with a light debounce
  useEffect(() => {
    const id = setTimeout(() => {
      if (email && email.includes('@')) {
        setOnboardingData('email', email);
        if (!emailEnteredFired.current) {
          emailEnteredFired.current = true;
          track('payment_email_entered');
        }
      }
    }, 400);
    return () => clearTimeout(id);
  }, [email]);

  const goalsList = useMemo(() => {
    const goals: string[] = [];
    if (data.mainGoal)
      goals.push(`Головна ціль: ${labelFor('mainGoal', data.mainGoal)}`);
    if (data.shortGoal?.length)
      goals.push(
        `Короткі цілі: ${data.shortGoal.map((g) => labelFor('shortGoal', g)).join(', ')}`
      );
    return goals;
  }, [data]);

  const onPay = async () => {
    setError(null);
    if (!email || !email.includes('@')) {
      track('checkout_blocked', { reason: 'invalid_email' });
      setError('Вкажіть коректний email для отримання доступу.');
      // Доскролюємо до секції з полем email, де треба виправити дані.
      paySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSubmitting(true);
    try {
      const plan = PLANS[selectedPlan];
      const orderId = `ND-${selectedPlan}-${Date.now()}`;
      try {
        localStorage.setItem('lastOrderId', orderId);
      } catch {}

      const attribution = readAttribution(window.localStorage);
      // Beacon: the LiqPay redirect can happen before the batch queue flushes.
      // Сума — очікувана ефективна (сервер порахує авторитетно за кукою).
      track(
        'checkout_started',
        { plan: selectedPlan, amount: discountActive ? plan.discountAmount : plan.amount },
        { beacon: true }
      );
      identify(email);

      const description = `${plan.title} | ${goalHeadline(data)}`;

      // Initialize subscription in DB with payment status pending
      const initRes = await fetch('/api/subscription/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          onboardingData: data,
          planId: selectedPlan,
          orderId,
          utmSource: attribution.utmSource,
          utmMedium: attribution.utmMedium,
          utmCampaign: attribution.utmCampaign,
        }),
      });

      if (!initRes.ok) {
        const t = await initRes.json().catch(() => null);
        throw new Error(t?.message || 'Помилка ініціалізації підписки.');
      }

      const initBody: { status?: string } = await initRes.json();
      if (initBody?.status === 'active') {
        setError('У вас вже є активна підписка. Переходимо до меню…');
        setSubmitting(false);
        setTimeout(() => router.push('/menu'), 1200);
        return;
      }

      // Show local pending indicator
      setPaymentStatus('pending');

      const res = await fetch('/api/liqpay/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          orderId,
          email,
          planId: selectedPlan,
        }),
      });

      if (!res.ok) {
        const t = await res.json().catch(() => null);
        throw new Error(t?.message || 'Помилка створення платежу');
      }

      const { data: liqData, signature } = await res.json();

      // Submit to LiqPay via auto-generated form
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://www.liqpay.ua/api/3/checkout';
      form.acceptCharset = 'utf-8';

      const inputData = document.createElement('input');
      inputData.type = 'hidden';
      inputData.name = 'data';
      inputData.value = liqData;
      form.appendChild(inputData);

      const inputSign = document.createElement('input');
      inputSign.type = 'hidden';
      inputSign.name = 'signature';
      inputSign.value = signature;
      form.appendChild(inputSign);

      // form.submit() below navigates away immediately — beacon survives it.
      track('redirected_to_liqpay', { plan: selectedPlan, orderId }, { beacon: true });
      document.body.appendChild(form);
      form.submit();
    } catch (e: any) {
      setError(e?.message || 'Щось пішло не так.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Стікі-хедер сторінки: Sytno зліва, таймер знижки (після 0:00 лишається
          з нулями) + CTA справа. Липне до верху вьюпорта при скролі. */}
      <div className="sticky top-0 z-30 border-b border-ink/5 bg-cream/95 font-body backdrop-blur dark:border-night-ink/10 dark:bg-night/95">
        <div className="mx-auto flex max-w-[1128px] items-center gap-3 px-4 py-3">
          <span className="font-logo text-2xl text-sage-dark dark:text-sage-light">
            Sytno
          </span>
          <div className="ml-auto flex items-center gap-3">
            {discount !== null && discount.until !== null && (() => {
              const { mm, ss } = countdownParts(discountActive ? remainingMs : 0);
              const digitColor = discountActive
                ? 'text-terracotta'
                : 'text-ink/40 dark:text-night-muted';
              return (
                <div
                  className="flex items-center gap-2"
                  title={discountActive ? 'Знижка діє ще' : 'Час знижки вичерпано'}
                >
                  <span className="whitespace-nowrap text-xs font-semibold text-ink/60 sm:text-base dark:text-night-muted">
                    Резерв ціни на:
                  </span>
                  <div className="flex items-start gap-0.5">
                    <div className="flex flex-col items-center">
                      <span className={`font-heading text-xl font-bold leading-none tabular-nums ${digitColor}`}>
                        {mm}
                      </span>
                      <span className="text-[10px] text-ink/50 dark:text-night-muted">
                        хв.
                      </span>
                    </div>
                    <span className={`font-heading text-xl font-bold leading-none ${digitColor}`}>
                      :
                    </span>
                    <div className="flex flex-col items-center">
                      <span className={`font-heading text-xl font-bold leading-none tabular-nums ${digitColor}`}>
                        {ss}
                      </span>
                      <span className="text-[10px] text-ink/50 dark:text-night-muted">
                        сек.
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}
            <button
              type="button"
              disabled={submitting}
              onClick={onPay}
              className={`rounded-xl bg-terracotta px-4 py-2 text-sm font-bold text-card transition-colors hover:bg-terracotta-dark ${
                submitting ? 'cursor-not-allowed opacity-70' : ''
              }`}
            >
              Візьми свій план
            </button>
          </div>
        </div>
      </div>

    <OnboardingLayout wide bare>
      <div className="flex flex-col gap-6">
        {/* Goals Summary */}
        <section className="rounded-3xl bg-card p-5 shadow-soft dark:bg-night-card">
          <h2 className="mb-2 font-heading text-xl font-bold">Ваші цілі</h2>
          {goalsList.length > 0 ? (
            <ul className="list-disc pl-5 text-ink/80 dark:text-night-ink/80">
              {goalsList.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          ) : (
            <p className="text-ink/80 dark:text-night-ink/80">
              Цілі ще не вказані.
            </p>
          )}
          <p className="mt-3 text-sm text-ink/60 dark:text-night-muted">
            З нашим планом ви досягнете {goalHeadline(data)} — покроково та без
            зайвого стресу.
          </p>
        </section>

        {/* Plans */}
        <section className="rounded-3xl bg-card p-5 shadow-soft dark:bg-night-card">
          <h2 className="mb-3 font-heading text-xl font-bold">Вибери свій план</h2>

          {discount !== null && !discountActive && discount.until === null ? (
            <Link
              href="/payment/surprise"
              className="mb-4 block rounded-xl bg-terracotta/10 px-4 py-3 text-sm font-semibold transition-colors hover:bg-terracotta/20"
            >
              🎁 На тебе чекає сюрприз — забери свою знижку
            </Link>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(Object.keys(PLANS) as PlanId[]).map((id) => {
              const plan = PLANS[id];
              const active = selectedPlan === id;
              const price = discountActive ? plan.discountAmount : plan.amount;
              const perDay = (price / plan.days).toFixed(1).replace('.', ',');
              const isPopular = id === 'month';
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => {
                    setSelectedPlan(id);
                    track('plan_selected', { plan: id });
                  }}
                  className={`relative flex flex-col overflow-hidden rounded-2xl border-2 text-left transition ${
                    isPopular ? '' : 'sm:mt-7'
                  } ${
                    active
                      ? 'border-ink bg-card shadow-soft dark:border-night-ink dark:bg-night-card'
                      : 'border-ink/10 bg-cream dark:border-night-ink/10 dark:bg-night'
                  }`}
                >
                  {isPopular && (
                    <div className="bg-ink py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.15em] text-cream dark:bg-night-ink dark:text-night">
                      Найпопулярніший
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-heading text-lg font-bold">{plan.shortTitle}</div>
                      <span
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                          active
                            ? 'border-ink bg-ink text-cream dark:border-night-ink dark:bg-night-ink dark:text-night'
                            : 'border-ink/20 dark:border-night-muted/40'
                        }`}
                      >
                        {active && <Check className="h-4 w-4" />}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      {discountActive && (
                        <span className="text-ink/50 line-through dark:text-night-muted">
                          {plan.amount} ₴
                        </span>
                      )}
                      <span className="font-semibold">{price} ₴</span>
                      {discountActive && (
                        <span className="rounded bg-terracotta/15 px-1.5 py-0.5 text-xs font-bold text-terracotta">
                          −{plan.discountPct}%
                        </span>
                      )}
                    </div>
                    <div className="mt-4 border-t border-ink/10 pt-3 dark:border-night-ink/10">
                      <span className="font-heading text-2xl font-bold">{perDay} ₴</span>
                      <span className="ml-1.5 text-xs text-ink/60 dark:text-night-muted">
                        за день
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="mt-4 text-sm text-danger dark:text-danger-dark">
              {error}
            </div>
          )}
          {paymentStatus === 'pending' && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-terracotta-light/20 px-2 py-1 text-xs font-medium text-terracotta-dark dark:bg-terracotta/15 dark:text-terracotta-light">
              <span className="inline-block h-2 w-2 rounded-full bg-terracotta"></span>
              Статус оплати: pending
            </div>
          )}
          <button
            type="button"
            disabled={submitting}
            onClick={onPay}
            className={`mx-auto mt-5 block w-full max-w-[440px] rounded-2xl bg-terracotta p-4 text-center font-semibold text-card shadow-soft transition-all hover:bg-terracotta-dark active:scale-95 ${
              submitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {submitting ? 'Створення платежу…' : 'Забрати план'}
          </button>
          <p className="mt-2 text-center text-xs text-ink/60 dark:text-night-muted">
            Оплата карткою. На Android/Chrome доступний Google Pay через LiqPay.
          </p>
        </section>

        {/* Email */}
        <section
          ref={paySectionRef}
          className="rounded-3xl bg-card p-5 shadow-soft dark:bg-night-card"
        >
          <div className="flex items-center gap-3">
            <h2 className="whitespace-nowrap font-heading text-xl font-bold">
              Email доступу
            </h2>
            <input
              type="email"
              placeholder="you@example.com"
              className="ph-no-capture w-full min-w-0 flex-1 rounded-xl border border-ink/15 bg-transparent p-3 outline-none transition-colors focus:border-sage focus:ring-2 focus:ring-sage-light/50 dark:border-night-ink/15"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => email && setOnboardingData('email', email)}
            />
          </div>
          <p className="mt-2 text-xs text-ink/60 dark:text-night-muted">
            Email буде збережено в ваших даних (localStorage) та передано в
            оплату.
          </p>
        </section>

        {/* Що входить у план — слайдер скріншотів сервісу з лендінгу */}
        <ExampleWorkSection
          embedded
          title="Що входить у ваш тарифний план"
        />
      </div>
    </OnboardingLayout>
    </>
  );
}
