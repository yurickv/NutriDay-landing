'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';

interface QuizLayoutProps {
  title: string;
  hint?: string;
  /** Лічильник «Питання N з M» — null для інфо-екранів і лоадера. */
  progress: { index: number; total: number } | null;
  /** Заповнення прогрес-бару 0–100 по всіх видимих екранах. */
  progressPct: number;
  onBack?: () => void;
  /** Ключ кроку — рестартує анімацію появи при переході. */
  animationKey?: string;
  /** true під час виходу з кроку — контент плавно зникає. */
  leaving?: boolean;
  children: React.ReactNode;
}

export function QuizLayout({
  title,
  hint,
  progress,
  progressPct,
  onBack,
  animationKey,
  leaving,
  children,
}: QuizLayoutProps) {
  return (
    <div className="min-h-dvh bg-cream font-body text-ink dark:bg-night dark:text-night-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-8 pt-4">
        <header className="flex items-center">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label="Назад"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft transition-colors hover:bg-sage-light/40 dark:bg-night-card dark:hover:bg-night-card/70"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <div className="h-10 w-10" aria-hidden />
          )}
          <span className="flex-1 text-center text-xs font-semibold uppercase tracking-[0.18em] text-ink/60 dark:text-night-muted">
            {progress ? `Питання ${progress.index} з ${progress.total}` : ' '}
          </span>
          <div className="h-10 w-10" aria-hidden />
        </header>

        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-sage-light/50 dark:bg-night-card">
          <div
            className="h-full rounded-full bg-sage transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
          />
        </div>

        {/* Хедер і прогрес-бар статичні; анімується лише контент кроку */}
        <StepTransition key={animationKey} leaving={leaving}>
          <h1 className="mt-8 font-heading text-[28px] font-bold leading-snug">{title}</h1>
          {hint && (
            <p className="mt-3 text-[15px] leading-relaxed text-ink/70 dark:text-night-muted">
              {hint}
            </p>
          )}

          <div className="mt-6 flex flex-1 flex-col">{children}</div>
        </StepTransition>
      </div>
    </div>
  );
}

// Поява/зникнення кроку. Стартовий стан заданий ІНЛАЙН-стилем — перший кадр
// фізично не може намалюватись видимим (клас/стилшит тут ні до чого не
// прив'язані). Подвійний rAF гарантує один кадр у прихованому стані, після
// чого transition веде до видимого.
function StepTransition({
  leaving,
  children,
}: {
  leaving?: boolean;
  children: React.ReactNode;
}) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  const hidden = leaving || !entered;
  return (
    <div
      className="flex flex-1 flex-col transition-[opacity,transform] duration-200 motion-reduce:transition-none"
      style={{
        opacity: hidden ? 0 : 1,
        transform: !entered && !leaving ? 'translateY(16px)' : 'none',
        transitionTimingFunction: leaving ? 'ease-in' : 'ease-out',
      }}
    >
      {children}
    </div>
  );
}

export function QuizCta({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-2xl bg-terracotta px-6 py-4 text-center font-heading font-bold text-white shadow-soft transition-colors hover:bg-terracotta-dark disabled:opacity-40 disabled:hover:bg-terracotta"
    >
      {children}
    </button>
  );
}
