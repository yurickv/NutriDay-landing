'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import { track, identify } from '@/lib/analytics';

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmPageContent />
    </Suspense>
  );
}

const ERRORS: Record<string, string> = {
  missing_token: 'Посилання неповне. Запросіть новий лист для входу.',
  invalid_or_expired: 'Посилання недійсне або вже використане. Запросіть новий лист.',
  server_error: 'Сталася помилка. Спробуйте ще раз або запросіть новий лист.',
};

function ConfirmPageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    if (!token) {
      setError(ERRORS.missing_token);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/magic-link/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => null)) as
        | { success?: boolean; redirect?: string; error?: string; email?: string }
        | null;

      if (res.ok && data?.success && data.redirect) {
        if (data.email) identify(data.email);
        track('login_completed');
        router.push(data.redirect);
        return;
      }
      setError(ERRORS[data?.error ?? 'server_error'] ?? ERRORS.server_error);
    } catch {
      setError(ERRORS.server_error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingLayout
      title="Підтвердження входу"
      subtitle="Один крок до вашого кабінету"
    >
      <div className="max-w-md mx-auto bg-card dark:bg-night-card rounded-2xl p-5 shadow-soft flex flex-col gap-4">
        {!token ? (
          <>
            <p className="text-sm text-ink/70 dark:text-night-muted">
              {ERRORS.missing_token}
            </p>
            <a
              href="/auth/login"
              className="w-full rounded-full p-3 text-card font-semibold text-center bg-terracotta hover:bg-terracotta-dark transition-colors duration-200"
            >
              Запросити новий лист
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-ink/70 dark:text-night-muted">
              Натисніть кнопку нижче, щоб завершити вхід до свого кабінету
              Sytno.
            </p>

            {error && (
              <div className="text-xs text-danger dark:text-danger-dark">{error}</div>
            )}

            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={submitting}
              className={`w-full rounded-full p-3 text-card font-semibold text-center transition-colors duration-200 bg-terracotta hover:bg-terracotta-dark ${
                submitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {submitting ? 'Входимо…' : 'Підтвердити вхід'}
            </button>

            {error && (
              <a
                href="/auth/login"
                className="text-[11px] text-ink/50 dark:text-night-muted text-center underline"
              >
                Запросити новий лист для входу
              </a>
            )}
          </>
        )}
      </div>
    </OnboardingLayout>
  );
}
