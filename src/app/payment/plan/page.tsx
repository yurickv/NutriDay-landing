// app/payment/plan/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import {
  getOnboardingData,
  setOnboardingData,
} from '@/utils/onboardingHelpers';
import type { OnboardingData } from '@/types/onboarding';

type PlanId = 'week' | 'month';

const PLANS: Record<
  PlanId,
  { title: string; description: string; amount: number }
> = {
  week: {
    title: 'Меню на тиждень',
    description: 'План харчування на 7 днів з рецептами та списком покупок',
    amount: 199, // TODO: скоригуйте ціну під ваш тариф
  },
  month: {
    title: 'Меню 4 етапами на місяць',
    description: 'Покрокове меню на 4 тижні з рекомендаціями та підтримкою',
    amount: 399, // TODO: скоригуйте ціну під ваш тариф
  },
};

function goalHeadline(data: OnboardingData) {
  const map: Record<string, string> = {
    lose_weight: 'здорового схуднення',
    build_muscle: 'набору м’язової маси',
    gain_weight: 'здорового набору ваги',
  };
  return map[data.mainGoal || ''] || 'ваших цілей';
}

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<OnboardingData>({});
  const [email, setEmail] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('week');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending'>(
    'idle'
  );
  const [agreePersonalData, setAgreePersonalData] = useState(false);
  const [agreeOferta, setAgreeOferta] = useState(false);

  useEffect(() => {
    const d = getOnboardingData();
    setData(d);
    if ((d as any).email) setEmail((d as any).email);
  }, []);

  // Persist email with a light debounce
  useEffect(() => {
    const id = setTimeout(() => {
      if (email && email.includes('@')) {
        setOnboardingData('email', email);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [email]);

  const goalsList = useMemo(() => {
    const goals: string[] = [];
    if (data.mainGoal) goals.push(`Головна ціль: ${data.mainGoal}`);
    if (data.shortGoal?.length)
      goals.push(`Короткі цілі: ${data.shortGoal.join(', ')}`);
    if (data.additionalGoal?.length)
      goals.push(`Додатково: ${data.additionalGoal.join(', ')}`);
    return goals;
  }, [data]);

  const onPay = async () => {
    setError(null);
    if (!agreePersonalData || !agreeOferta) {
      setError('Будь ласка, підтвердіть згоди перед оплатою.');
      return;
    }
    if (!email || !email.includes('@')) {
      setError('Вкажіть коректний email для отримання доступу.');
      return;
    }

    setSubmitting(true);
    try {
      const plan = PLANS[selectedPlan];
      const orderId = `ND-${selectedPlan}-${Date.now()}`;
      try {
        localStorage.setItem('lastOrderId', orderId);
      } catch {}
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
          amount: plan.amount,
          description,
          orderId,
          currency: 'UAH',
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

      document.body.appendChild(form);
      form.submit();
    } catch (e: any) {
      setError(e?.message || 'Щось пішло не так.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingLayout
      title="Ваш кабінет"
      subtitle="Підіб’ємо ваші цілі та оформимо доступ"
    >
      <div className="flex flex-col gap-6">
        {/* Goals Summary */}
        <section className="bg-white dark:bg-dark-body rounded-lg p-5 shadow">
          <h2 className="text-xl font-semibold mb-2">Ваші цілі</h2>
          {goalsList.length > 0 ? (
            <ul className="list-disc pl-5 text-main-text dark:text-main-text-black">
              {goalsList.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          ) : (
            <p className="text-main-text dark:text-main-text-black">
              Цілі ще не вказані.
            </p>
          )}
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            З нашим планом ви досягнете {goalHeadline(data)} — покроково та без
            зайвого стресу.
          </p>
        </section>

        {/* Plans */}
        <section className="bg-white dark:bg-dark-body rounded-lg p-5 shadow">
          <h2 className="text-xl font-semibold mb-3">Плани підписки</h2>
          <div className="grid grid-cols-1 gap-3">
            {(Object.keys(PLANS) as PlanId[]).map((id) => {
              const plan = PLANS[id];
              const active = selectedPlan === id;
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => setSelectedPlan(id)}
                  className={`w-full text-left border rounded-lg p-4 transition ${
                    active
                      ? 'border-orange-500 bg-orange-50 dark:bg-[#5a4d48]'
                      : 'border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{plan.title}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {plan.description}
                      </div>
                    </div>
                    <div className="text-lg font-semibold">{plan.amount} ₴</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Email */}
        <section className="bg-white dark:bg-dark-body rounded-lg p-5 shadow">
          <h2 className="text-xl font-semibold mb-2">Email доступу</h2>
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => email && setOnboardingData('email', email)}
          />
          <p className="text-xs mt-2 text-gray-500">
            Email буде збережено в ваших даних (localStorage) та передано в
            оплату.
          </p>
        </section>

        {/* Payment */}
        <section className="bg-white dark:bg-dark-body rounded-lg p-5 shadow">
          {error && (
            <div className="mb-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
          {/* Consents */}
          <div className="flex flex-col gap-2 mb-4">
            <label className="flex items-start gap-3 text-sm text-main-text dark:text-main-text-black">
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 accent-orange-500 cursor-pointer"
                checked={agreePersonalData}
                onChange={(e) => setAgreePersonalData(e.target.checked)}
              />
              <span>Я надаю згоду на обробку моїх персональних даних</span>
            </label>
            <label className="flex items-start gap-3 text-sm text-main-text dark:text-main-text-black">
              <input
                type="checkbox"
                className="mt-1 w-4 h-4 accent-orange-500 cursor-pointer"
                checked={agreeOferta}
                onChange={(e) => setAgreeOferta(e.target.checked)}
              />
              <span>
                Я погоджуюсь з умовами та{' '}
                <Link
                  href="/oferta"
                  className="text-orange-600 hover:text-orange-700 underline"
                >
                  публічною офертою
                </Link>
                .
              </span>
            </label>
          </div>
          {paymentStatus === 'pending' && (
            <div className="mb-3 inline-flex items-center gap-2 text-xs font-medium px-2 py-1 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
              Статус оплати: pending
            </div>
          )}
          <button
            type="button"
            disabled={submitting}
            onClick={onPay}
            className={`w-full rounded-xl p-4 text-white text-center transition-all duration-200 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 ${
              submitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {submitting ? 'Створення платежу…' : 'Оплатити через LiqPay / GPay'}
          </button>
          <p className="text-xs mt-2 text-gray-500">
            Оплата карткою. На Android/Chrome доступний Google Pay через LiqPay.
          </p>
        </section>
      </div>
    </OnboardingLayout>
  );
}
