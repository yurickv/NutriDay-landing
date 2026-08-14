'use client';

// Сторінка-сюрприз між квізом і оплатою: скретч-картка відкриває знижку
// і запускає 10-хвилинне вікно (httpOnly-кука через POST /api/discount).
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScratchCard } from '@/components/payment/ScratchCard';
import { QuizCta } from '@/components/onboarding/QuizLayout';
import { track } from '@/lib/analytics';

type DiscountState = { active: boolean; until: number | null };

export default function SurprisePage() {
  const router = useRouter();
  // null — ще питаємо сервер про стан вікна знижки.
  const [state, setState] = useState<DiscountState | null>(null);
  const revealedOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/discount')
      .then((res) => (res.ok ? res.json() : { active: false, until: null }))
      .then((s: DiscountState) => {
        if (cancelled) return;
        // Вікно вже відкривалось і згоріло — сюрпризу вдруге немає.
        if (!s.active && s.until !== null) {
          router.replace('/payment/plan');
          return;
        }
        setState(s);
      })
      .catch(() => !cancelled && setState({ active: false, until: null }));
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleReveal = () => {
    if (revealedOnce.current) return;
    revealedOnce.current = true;
    track('discount_revealed');
    fetch('/api/discount', { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((s: DiscountState | null) => s && setState(s))
      .catch(() => {});
  };

  if (state === null) {
    return <div className="min-h-dvh bg-cream dark:bg-night" />;
  }

  const revealed = state.active || revealedOnce.current;

  return (
    <div className="min-h-dvh bg-cream font-body text-ink dark:bg-night dark:text-night-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center px-5 pb-8 pt-16 text-center">
        <h1 className="font-heading text-[28px] font-bold leading-snug">
          Маємо сюрприз для тебе 🎁
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink/70 dark:text-night-muted">
          Хочемо, щоб твоя подорож почалась зі знижкою. Потри картку — і забери
          свій подарунок.
        </p>

        <div className="mt-8 flex w-full justify-center">
          <ScratchCard revealed={state.active} onReveal={handleReveal}>
            <p className="font-heading text-5xl font-bold text-terracotta">−60%</p>
            <p className="mt-3 text-[15px] font-semibold">на плани Sytno</p>
            <p className="mt-1 text-sm text-ink/60 dark:text-night-muted">
              діє наступні 10 хвилин
            </p>
          </ScratchCard>
        </div>

        <div className="mt-auto w-full pt-10">
          {revealed ? (
            <QuizCta onClick={() => router.push('/payment/plan')}>
              Забрати знижку
            </QuizCta>
          ) : (
            <p className="text-sm text-ink/60 dark:text-night-muted">
              Зітри покриття пальцем або мишкою
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
