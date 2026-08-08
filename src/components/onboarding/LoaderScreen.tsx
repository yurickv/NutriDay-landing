'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { getOnboardingData } from '@/utils/onboardingHelpers';
import { track } from '@/lib/analytics';

const STAGES = ['Профіль', 'Харчові звички', 'Обмеження', 'Норма калорій', 'Меню'];
const STAGE_MS = 1200;

// D3: фіксована тривалість (до появи /api/menu/preview — спека §7 п.5).
// POST /api/onboarding — no-op підтвердження; onboarding_completed — перед
// редіректом на /payment/plan (перенесено з creating-plan/page.tsx:34).
export function LoaderScreen() {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const submitted = useRef(false);
  const completed = useRef(false);

  useEffect(() => {
    if (!submitted.current) {
      submitted.current = true;
      fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(getOnboardingData()),
      }).catch(() => {});
    }

    const id = setInterval(() => {
      setStage((s) => {
        if (s >= STAGES.length - 1) {
          clearInterval(id);
          if (!completed.current) {
            completed.current = true;
            track('onboarding_completed');
            router.push('/payment/plan');
          }
          return s;
        }
        return s + 1;
      });
    }, STAGE_MS);

    return () => clearInterval(id);
  }, [router]);

  return (
    <div className="flex flex-1 flex-col justify-center gap-3 pb-16">
      {STAGES.map((label, i) => {
        const done = i < stage;
        const current = i === stage;
        return (
          <div
            key={label}
            className={`flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 shadow-soft transition-opacity dark:bg-night-card ${
              done || current ? 'opacity-100' : 'opacity-40'
            }`}
          >
            <span
              className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ${
                done
                  ? 'bg-sage text-white'
                  : current
                    ? 'border-2 border-sage'
                    : 'border-2 border-ink/20 dark:border-night-muted/40'
              }`}
            >
              {done && <Check className="h-4 w-4" />}
              {current && (
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sage" />
              )}
            </span>
            <span className="font-semibold">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
