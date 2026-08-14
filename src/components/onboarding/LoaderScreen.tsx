'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { getOnboardingData } from '@/utils/onboardingHelpers';
import { track } from '@/lib/analytics';

const STAGES = ['Профіль', 'Харчові звички', 'Обмеження', 'Норма калорій', 'Меню'];
const STAGE_MS = 2000;
const TICK_MS = 60;
const TICK_PCT = 100 / (STAGE_MS / TICK_MS); // 5% за тік → 1.2 с на стадію
const TOTAL = STAGES.length * 100; // прогрес суцільний: 100 одиниць на стадію

// D3: фіксована тривалість (до появи /api/menu/preview — спека §7 п.5).
// POST /api/onboarding — no-op підтвердження; onboarding_completed — перед
// редіректом на /payment/plan (перенесено з creating-plan/page.tsx:34).
export function LoaderScreen() {
  const router = useRouter();
  const [progress, setProgress] = useState(0); // 0..TOTAL
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

    // Апдейтер мусить бути чистим (React виконує його під час рендеру) —
    // навігація і трекінг живуть в окремому ефекті нижче.
    const id = setInterval(() => {
      setProgress((p) => Math.min(p + TICK_PCT, TOTAL));
    }, TICK_MS);

    return () => clearInterval(id);
  }, []);

  // progress === TOTAL — усі стадії пройдені: трек + сторінка-сюрприз зі знижкою.
  useEffect(() => {
    if (progress < TOTAL || completed.current) return;
    completed.current = true;
    track('onboarding_completed');
    router.push('/payment/surprise');
  }, [progress, router]);

  return (
    <div className="flex flex-1 flex-col justify-center gap-3 pb-16">
      {STAGES.map((label, i) => {
        const pct = Math.round(Math.min(Math.max(progress - i * 100, 0), 100));
        const done = pct >= 100;
        const active = pct > 0;
        return (
          <div
            key={label}
            className={`rounded-2xl bg-card px-4 py-3.5 shadow-soft transition-opacity dark:bg-night-card ${
              active ? 'opacity-100' : 'opacity-40'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">{label}</span>
              {done ? (
                <Check className="h-5 w-5 flex-shrink-0 text-sage" />
              ) : (
                <span className="text-sm font-semibold tabular-nums text-ink/60 dark:text-night-muted">
                  {pct}%
                </span>
              )}
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink/10 dark:bg-night-ink/10">
              <div
                className="h-full rounded-full bg-sage transition-[width] duration-75 ease-linear"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
