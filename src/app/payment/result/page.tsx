// app/payment/result/page.tsx
"use client";

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';

export default function PaymentResultPage() {
  return (
    <Suspense fallback={null}>
      <PaymentResultContent />
    </Suspense>
  );
}

function PaymentResultContent() {
  const params = useSearchParams();
  const router = useRouter();

  // LiqPay may pass order_id or _order_id
  const statusParam = (params.get('status') || '').toLowerCase();
  const orderIdParam = params.get('order_id') || params.get('_order_id') || '';
  const [orderId, setOrderId] = useState<string>(orderIdParam);
  const email = params.get('email') || '';

  const [dbStatus, setDbStatus] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    if (orderIdParam) return;
    try {
      const last = localStorage.getItem('lastOrderId');
      if (last) setOrderId(last);
    } catch {}
  }, [orderIdParam]);

  const effectiveStatus = (dbStatus || statusParam || '').toLowerCase();

  useEffect(() => {
    // If we don’t have success/failure in the URL, poll backend by orderId to get real status
    const shouldPoll = !['success', 'subscribed', 'failure', 'error', 'reversed', 'cancelled', 'canceled', 'active']
      .includes(effectiveStatus) && !!orderId;
    if (!shouldPoll) return;

    let cancelled = false;
    setPolling(true);

    const fetchStatus = async () => {
      try {
        const qs = new URLSearchParams();
        if (orderId) qs.set('orderId', orderId);
        if (email) qs.set('email', email);
        const res = await fetch(`/api/subscription/status?${qs.toString()}`);
        if (cancelled) return;
        if (res.ok) {
          const j = await res.json();
          const s = (j?.paymentStatus || '').toLowerCase();
          if (s) setDbStatus(s);
          // If still pending, ask LiqPay directly (server makes the request and updates DB)
          if (!['active', 'failed'].includes(s) && orderId) {
            const liqRes = await fetch(`/api/liqpay/status?orderId=${encodeURIComponent(orderId)}`);
            if (!cancelled && liqRes.ok) {
              const lj = await liqRes.json();
              const ns = (lj?.updatedTo || '').toLowerCase();
              if (ns) setDbStatus(ns);
            }
          }
        }
      } catch {}
    };

    // Initial fetch and then poll
    fetchStatus();
    const id = setInterval(fetchStatus, 3500);
    return () => {
      cancelled = true;
      clearInterval(id);
      setPolling(false);
    };
  }, [orderId, email, effectiveStatus]);

  const message = useMemo(() => {
    switch (effectiveStatus) {
      case 'success':
      case 'subscribed':
      case 'active':
        return 'Дякуємо! Оплата пройшла успішно. Підписка активна або буде активована найближчим часом.';
      case 'failure':
      case 'error':
        return 'Оплата не пройшла. Спробуйте ще раз або оберіть інший спосіб.';
      case 'processing':
      case 'wait_secure':
      default:
        return 'Оплата обробляється. Зачекайте підтвердження…';
    }
  }, [effectiveStatus]);

  return (
    <OnboardingLayout title="Статус оплати" subtitle="Результат транзакції LiqPay">
      <div className="flex flex-col gap-6">
        <section className="bg-white dark:bg-dark-body rounded-lg p-5 shadow">
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            {orderId && (
              <div>
                Номер замовлення: <span className="font-mono">{orderId}</span>
              </div>
            )}
            <div>
              Поточний статус:{' '}
              <span className="font-semibold">
                {effectiveStatus || 'невідомо'}
                {polling && !['success', 'subscribed', 'failure', 'error', 'active'].includes(effectiveStatus) ? ' (оновлюємо…) ' : ''}
              </span>
            </div>
          </div>
          <div className="text-base">{message}</div>
        </section>

        <div className="flex gap-3">
          <button
            className="rounded-lg px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 transition"
            onClick={() => router.push('/dashboard')}
          >
            Повернутися до дашборду
          </button>
          <Link
            href="/menu"
            className="rounded-lg px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Перейти до меню
          </Link>
        </div>
      </div>
    </OnboardingLayout>
  );
}
