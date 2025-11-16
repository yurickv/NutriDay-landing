'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import { getOnboardingData } from '@/utils/onboardingHelpers';

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
  const urlStatusRaw = (params.get('status') || '').toLowerCase();
  const statusParam = urlStatusRaw === 'sandbox' ? 'active' : urlStatusRaw;
  const orderIdParam = params.get('order_id') || params.get('_order_id') || '';
  const [orderId, setOrderId] = useState<string>(orderIdParam);
  const emailParam = params.get('email') || '';

  const [resolvedEmail, setResolvedEmail] = useState<string>(emailParam);
  const [dbStatus, setDbStatus] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [magicSending, setMagicSending] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);
  const [autoMagicSent, setAutoMagicSent] = useState(false);

  useEffect(() => {
    if (orderIdParam) return;
    try {
      const last = localStorage.getItem('lastOrderId');
      if (last) setOrderId(last);
    } catch {
      // ignore
    }
  }, [orderIdParam]);

  // Try to recover email from onboarding data if not provided in URL
  useEffect(() => {
    if (resolvedEmail) return;
    try {
      const d = getOnboardingData();
      const savedEmail = (d as any).email;
      if (savedEmail && typeof savedEmail === 'string') {
        setResolvedEmail(savedEmail);
      }
    } catch {
      // ignore
    }
  }, [resolvedEmail]);

  const effectiveStatus = (dbStatus || statusParam || '').toLowerCase();

  const isPaid = ['success', 'subscribed', 'active'].includes(effectiveStatus);
  const isFailed = [
    'failure',
    'error',
    'reversed',
    'cancelled',
    'canceled',
    'failed',
  ].includes(effectiveStatus);

  useEffect(() => {
    // If we don't have success/failure in the URL, poll backend by orderId to get real status
    const shouldPoll =
      ![
        'success',
        'subscribed',
        'failure',
        'error',
        'reversed',
        'cancelled',
        'canceled',
        'active',
      ].includes(effectiveStatus) && !!orderId;
    if (!shouldPoll) return;

    let cancelled = false;
    setPolling(true);

    const fetchStatus = async () => {
      try {
        const qs = new URLSearchParams();
        if (orderId) qs.set('orderId', orderId);
        if (resolvedEmail) qs.set('email', resolvedEmail);
        const res = await fetch(`/api/subscription/status?${qs.toString()}`);
        if (cancelled) return;
        if (res.ok) {
          const j = await res.json();
          const s = (j?.paymentStatus || '').toLowerCase();
          if (s) setDbStatus(s);
          if (!resolvedEmail && j?.email) {
            setResolvedEmail(j.email);
          }
          // If still pending, ask LiqPay directly (server makes the request and updates DB)
          if (!['active', 'failed'].includes(s) && orderId) {
            const liqRes = await fetch(
              `/api/liqpay/status?orderId=${encodeURIComponent(orderId)}`
            );
            if (!cancelled && liqRes.ok) {
              const lj = await liqRes.json();
              const ns = (lj?.updatedTo || '').toLowerCase();
              if (ns === 'active' || ns === 'failed') setDbStatus(ns);
            }
          }
        }
      } catch {
        // ignore
      }
    };

    // Initial fetch and then poll
    fetchStatus();
    const id = setInterval(fetchStatus, 3500);
    return () => {
      cancelled = true;
      clearInterval(id);
      setPolling(false);
    };
  }, [orderId, resolvedEmail, effectiveStatus]);

  const requestMagicLink = async (silent?: boolean) => {
    if (!resolvedEmail) {
      if (!silent) {
        setMagicError('Email для входу не знайдено.');
      }
      return;
    }
    if (!silent) {
      setMagicError(null);
    }
    setMagicSending(true);
    try {
      const res = await fetch('/api/auth/magic-link/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resolvedEmail }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || 'Помилка надсилання листа для входу.');
      }
      setMagicSent(true);
    } catch (e: any) {
      if (!silent) {
        setMagicError(e?.message || 'Помилка надсилання листа для входу.');
      }
    } finally {
      setMagicSending(false);
    }
  };

  // Автовідправка magic-link після підтвердженої оплати
  useEffect(() => {
    if (!isPaid || !resolvedEmail || autoMagicSent) return;
    setAutoMagicSent(true);
    void requestMagicLink(true);
  }, [isPaid, resolvedEmail, autoMagicSent]);

  const message = useMemo(() => {
    switch (effectiveStatus) {
      case 'success':
      case 'subscribed':
      case 'active':
        return 'Оплата успішна! Ми підготували для вас доступ до персонального меню.';
      case 'failure':
      case 'error':
      case 'reversed':
      case 'cancelled':
      case 'canceled':
      case 'failed':
        return 'Оплата не пройшла. Спробуйте ще раз або оберіть інший спосіб оплати.';
      case 'processing':
      case 'wait_secure':
      default:
        return 'Ми очікуємо підтвердження оплати від платіжного сервісу.';
    }
  }, [effectiveStatus]);

  return (
    <OnboardingLayout
      title="Результат оплати"
      subtitle="Статус транзакції в LiqPay"
    >
      <div className="flex flex-col gap-6">
        <section className="bg-white dark:bg-dark-body rounded-lg p-5 shadow">
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
            {orderId && (
              <div>
                Номер замовлення: <span className="font-mono">{orderId}</span>
              </div>
            )}
            <div>
              Статус платежу:{' '}
              <span className="font-semibold">
                {effectiveStatus || 'невідомо'}
                {polling &&
                ![
                  'success',
                  'subscribed',
                  'failure',
                  'error',
                  'active',
                  'reversed',
                  'cancelled',
                  'canceled',
                  'failed',
                ].includes(effectiveStatus)
                  ? ' (оновлюємо...) '
                  : ''}
              </span>
            </div>
          </div>
          <div className="text-base">{message}</div>

          {isPaid && (
            <div className="mt-4 text-sm text-main-text dark:text-main-text-black">
              Ми надіслали лист із магічним посиланням для входу у ваш кабінет
              {resolvedEmail && (
                <>
                  {' '}
                  на <span className="font-semibold">{resolvedEmail}</span>
                </>
              )}
              . Відкрийте лист і перейдіть за посиланням, щоб увійти.
            </div>
          )}

          {magicSent && (
            <div className="mt-2 text-xs text-green-700 dark:text-green-400">
              Лист для входу надіслано. Якщо його немає, перевірте папку
              «Спам».
            </div>
          )}

          {magicError && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400">
              {magicError}
            </div>
          )}
        </section>

        <div className="flex gap-3 flex-wrap">
          {!isPaid && (
            <button
              className="rounded-lg px-4 py-2 bg-orange-500 text-white hover:bg-orange-600 transition"
              onClick={() => router.push('/payment/plan')}
            >
              Спробувати оплатити ще раз
            </button>
          )}

          <Link
            href="/menu"
            className="rounded-lg px-4 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Перейти в меню
          </Link>

          {isPaid && (
            <button
              type="button"
              disabled={magicSending}
              onClick={() => requestMagicLink(false)}
              className={`rounded-lg px-4 py-2 border border-orange-500 text-orange-600 hover:bg-orange-50 transition ${
                magicSending ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {magicSending
                ? 'Надсилаємо лист...'
                : 'Надіслати лист для входу ще раз'}
            </button>
          )}
        </div>
      </div>
    </OnboardingLayout>
  );
}

