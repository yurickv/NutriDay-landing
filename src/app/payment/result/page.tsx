'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, X, Loader2 } from 'lucide-react';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import { getOnboardingData } from '@/utils/onboardingHelpers';
import { track, identify } from '@/lib/analytics';
import { parseOrderId, paymentSuccessInsertId, paymentFailedInsertId } from '@/lib/analytics/payment';
import { PLANS, isPlanId } from '@/lib/plans';

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
  const paymentEventFired = React.useRef(false);

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

  // Fire the payment outcome event once (closes the funnel client-side).
  useEffect(() => {
    if (paymentEventFired.current) return;
    if (!orderId) return;
    if (!isPaid && !isFailed) return;

    paymentEventFired.current = true;
    const { plan, ts } = parseOrderId(orderId);
    const amount = plan && isPlanId(plan) ? PLANS[plan].amount : undefined;
    const currency = plan && isPlanId(plan) ? PLANS[plan].currency : 'UAH';
    const timestamp = ts ? new Date(ts) : undefined;

    if (resolvedEmail) identify(resolvedEmail);

    if (isPaid) {
      track(
        'payment_succeeded',
        { plan: plan ?? undefined, amount, currency, orderId },
        { insertId: paymentSuccessInsertId(orderId), timestamp },
      );
    } else {
      track(
        'payment_failed',
        { status: effectiveStatus, orderId },
        { insertId: paymentFailedInsertId(orderId), timestamp },
      );
    }
  }, [isPaid, isFailed, orderId, resolvedEmail, effectiveStatus]);

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
    <OnboardingLayout>
      <div className="flex flex-col gap-8">
        {/* Становий блок: іконка + заголовок + повідомлення */}
        <div className="flex flex-col items-center gap-4 text-center">
          {isPaid ? (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sage/15 text-sage-dark dark:bg-sage/25 dark:text-sage-light">
              <Check className="h-8 w-8" aria-hidden />
            </span>
          ) : isFailed ? (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger dark:bg-danger/20 dark:text-danger-dark">
              <X className="h-8 w-8" aria-hidden />
            </span>
          ) : (
            <Loader2 className="h-12 w-12 animate-spin text-sage" aria-hidden />
          )}
          <h1 className="font-heading text-2xl font-bold md:text-3xl">
            {isPaid
              ? 'Оплата успішна!'
              : isFailed
                ? 'Оплата не пройшла'
                : 'Очікуємо підтвердження оплати…'}
          </h1>
          <p className="text-ink/80 dark:text-night-ink/80">{message}</p>

          {isPaid && (
            <p className="text-sm leading-relaxed text-ink/70 dark:text-night-ink/70">
              Ми надіслали лист із магічним посиланням для входу у ваш кабінет
              {resolvedEmail && (
                <>
                  {' '}
                  на <span className="font-semibold">{resolvedEmail}</span>
                </>
              )}
              . Відкрийте лист і перейдіть за посиланням, щоб увійти.
            </p>
          )}

          {magicSent && (
            <p className="text-xs text-sage-dark dark:text-sage-light">
              Лист для входу надіслано. Якщо його немає, перевірте папку
              «Спам».
            </p>
          )}

          {magicError && (
            <p className="text-xs text-danger dark:text-danger-dark">
              {magicError}
            </p>
          )}
        </div>

        {/* Кнопки в стилі квізу: primary terracotta + secondary outline */}
        <div className="mx-auto flex w-full max-w-[440px] flex-col gap-3">
          {isPaid ? (
            <>
              <Link
                href="/menu"
                className="rounded-2xl bg-terracotta px-6 py-4 text-center font-heading font-bold text-white shadow-soft transition-colors hover:bg-terracotta-dark"
              >
                Перейти в меню
              </Link>
              <button
                type="button"
                disabled={magicSending}
                onClick={() => requestMagicLink(false)}
                className={`rounded-2xl border-2 border-ink/15 px-6 py-3 text-center font-semibold transition-colors hover:bg-sage-light/30 dark:border-night-ink/15 dark:hover:bg-night-card ${
                  magicSending ? 'cursor-not-allowed opacity-70' : ''
                }`}
              >
                {magicSending
                  ? 'Надсилаємо лист...'
                  : 'Надіслати лист для входу ще раз'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => router.push('/payment/plan')}
                className="rounded-2xl bg-terracotta px-6 py-4 text-center font-heading font-bold text-white shadow-soft transition-colors hover:bg-terracotta-dark"
              >
                Спробувати оплатити ще раз
              </button>
              <Link
                href="/menu"
                className="rounded-2xl border-2 border-ink/15 px-6 py-3 text-center font-semibold transition-colors hover:bg-sage-light/30 dark:border-night-ink/15 dark:hover:bg-night-card"
              >
                Перейти в меню
              </Link>
            </>
          )}
        </div>

        {/* Технічні деталі транзакції */}
        <div className="border-t border-ink/10 pt-4 text-center text-xs text-ink/50 dark:border-night-ink/10 dark:text-night-muted">
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
      </div>
    </OnboardingLayout>
  );
}

