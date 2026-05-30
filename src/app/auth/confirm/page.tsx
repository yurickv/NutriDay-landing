'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';

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
        | { success?: boolean; redirect?: string; error?: string }
        | null;

      if (res.ok && data?.success && data.redirect) {
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
      <div className="max-w-md mx-auto bg-white dark:bg-dark-body rounded-lg p-5 shadow flex flex-col gap-4">
        {!token ? (
          <>
            <p className="text-sm text-main-text dark:text-main-text-black">
              {ERRORS.missing_token}
            </p>
            <a
              href="/auth/login"
              className="w-full rounded-xl p-3 text-white text-center bg-gradient-to-r from-red-500 to-orange-500"
            >
              Запросити новий лист
            </a>
          </>
        ) : (
          <>
            <p className="text-sm text-main-text dark:text-main-text-black">
              Натисніть кнопку нижче, щоб завершити вхід до свого кабінету
              NutriDay.
            </p>

            {error && (
              <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
            )}

            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={submitting}
              className={`w-full rounded-xl p-3 text-white text-center transition-all duration-200 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 ${
                submitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {submitting ? 'Входимо…' : 'Підтвердити вхід'}
            </button>

            {error && (
              <a
                href="/auth/login"
                className="text-[11px] text-gray-500 text-center underline"
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
