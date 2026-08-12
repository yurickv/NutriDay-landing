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
        className="max-w-md mx-auto bg-card dark:bg-night-card rounded-2xl p-5 shadow-soft flex flex-col gap-4"
      >
        <p className="text-sm text-ink/70 dark:text-night-muted">
          Вкажіть email, який ви використовували при оплаті. Ми надішлемо
          магічне посилання для входу. Після переходу за посиланням ви потрапите
          до свого меню.
        </p>

        <label className="flex flex-col gap-1 text-sm text-ink/70 dark:text-night-muted">
          Email
          <input
            type="email"
            className="w-full p-3 rounded-lg border border-sage-light dark:border-night-muted/40 bg-transparent outline-none"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        {error && (
          <div className="text-xs text-danger dark:text-danger-dark">{error}</div>
        )}
        {message && (
          <div className="text-xs text-sage-dark dark:text-sage-light">
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={`w-full rounded-full p-3 text-card font-semibold text-center transition-colors duration-200 bg-terracotta hover:bg-terracotta-dark ${
            submitting ? 'opacity-70 cursor-not-allowed' : ''
          }`}
        >
          {submitting ? 'Надсилаємо посилання...' : 'Надіслати магічне посилання'}
        </button>

        <p className="text-[11px] text-ink/50 dark:text-night-muted mt-1">
          Після входу ми автоматично перенаправимо вас до:{' '}
          <span className="font-mono">{redirectPath}</span>
        </p>

        <p className="text-sm text-ink/70 dark:text-night-muted text-center border-t border-ink/10 dark:border-night-muted/30 pt-4">
          Вперше тут?{' '}
          <Link
            href="/onboarding"
            className="text-terracotta dark:text-terracotta-light font-semibold underline underline-offset-4 hover:text-terracotta-dark"
          >
            Почніть з короткого опитування →
          </Link>
        </p>
      </form>
    </OnboardingLayout>
  );
}
