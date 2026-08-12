'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';

export default function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginFormContent />
    </Suspense>
  );
}

function LoginFormContent() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const redirectPath = params.get('redirect') || '/menu';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!email || !email.includes('@')) {
      setError('Вкажіть коректний email.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/magic-link/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.message || 'Не вдалося надіслати лист для входу.');
      }
      setMessage(
        'Ми надіслали лист із посиланням для входу. Перевірте пошту та перейдіть за посиланням.'
      );
    } catch (err: any) {
      setError(err?.message || 'Сталася помилка. Спробуйте ще раз.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingLayout
      title="Увійти в кабінет"
      subtitle="Отримайте магічне посилання на email"
    >
      <form
        onSubmit={onSubmit}
        className="max-w-md mx-auto bg-white dark:bg-dark-body rounded-lg p-5 shadow flex flex-col gap-4"
      >
        <p className="text-sm text-main-text dark:text-main-text-black">
          Вкажіть email, який ви використовували при оплаті. Ми надішлемо
          магічне посилання для входу. Після переходу за посиланням ви потрапите
          до свого меню.
        </p>

        <label className="flex flex-col gap-1 text-sm text-main-text dark:text-main-text-black">
          Email
          <input
            type="email"
            className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent outline-none"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        {error && (
          <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
        )}
        {message && (
          <div className="text-xs text-green-700 dark:text-green-400">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={`w-full rounded-xl p-3 text-white text-center transition-all duration-200 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 ${
            submitting ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {submitting ? 'Надсилаємо посилання...' : 'Надіслати магічне посилання'}
        </button>

        <p className="text-[11px] text-gray-500 mt-1">
          Після входу ми автоматично перенаправимо вас до:{' '}
          <span className="font-mono">{redirectPath}</span>
        </p>

        <p className="text-sm text-main-text dark:text-main-text-black text-center border-t border-gray-200 dark:border-gray-600 pt-4">
          Вперше тут?{' '}
          <Link
            href="/onboarding"
            className="text-orange-600 dark:text-orange-400 font-semibold underline underline-offset-4 hover:text-orange-700"
          >
            Почніть з короткого опитування →
          </Link>
        </p>
      </form>
    </OnboardingLayout>
  );
}
