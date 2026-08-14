'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';

interface QuizLayoutProps {
  title: string;
  hint?: string;
  /** Підпис групи кроків у хедері (Мета / Харчування / Тіло / Фініш). */
  groupLabel?: string;
  /** Заповнення прогрес-бару 0–100 по всіх видимих екранах. */
  progressPct: number;
  /** Фото-банер над заголовком (Step.headerImage). */
  image?: { src: string; alt: string };
  onBack?: () => void;
  /** Ключ кроку — рестартує анімацію появи при переході. */
  animationKey?: string;
  /** true під час виходу з кроку — контент плавно зникає. */
  leaving?: boolean;
  /** Широка колонка (1128px) на десктопі — інфо-екрани з фото. */
  wide?: boolean;
  /** Не рендерити h1/hint — крок малює заголовок сам (двоколонкові інфо-екрани). */
  hideHeading?: boolean;
  children: React.ReactNode;
}

export function QuizLayout({
  title,
  hint,
  groupLabel,
  progressPct,
  image,
  onBack,
  animationKey,
  leaving,
  wide = false,
  hideHeading = false,
  children,
}: QuizLayoutProps) {
  return (
    <div className="min-h-dvh bg-cream font-body text-ink dark:bg-night dark:text-night-ink">
      <div
        className={`mx-auto flex min-h-dvh w-full flex-col px-5 pb-8 pt-4 ${
          wide ? 'max-w-[1128px]' : 'max-w-[480px]'
        }`}
      >
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
            {groupLabel ?? ' '}
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
          {!hideHeading && (
            <>
              <h1 className="mt-8 font-heading text-[28px] font-bold leading-snug">{title}</h1>
              {hint && (
                <p className="mt-3 text-[15px] leading-relaxed text-ink/70 dark:text-night-muted">
                  {hint}
                </p>
              )}
            </>
          )}
          {image && (
            // Банер тягнеться на весь ВІЛЬНИЙ простір екрана (grow-[999] забирає
            // його майже повністю проти grow-1 контейнера з варіантами), тому
            // скрол не з'являється: коли місця нема — стискається до min-h-16.
            // basis-0 — висоту визначає лише flex, а не інтринсика фото;
            // max-h-80 — стеля для високих екранів.
            <div className="mt-5 min-h-16 max-h-80 grow-[999] basis-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.src}
                alt={image.alt}
                className="h-full w-full rounded-3xl object-cover shadow-soft"
              />
            </div>
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

// Контейнер кнопки «Далі». Інлайн-варіант притискає її до низу колонки
// (mt-auto); sticky-варіант липне до низу екрана на скрольних кроках —
// саме sticky, а не fixed, бо transform у StepTransition ламає fixed
// (кнопка їздила б разом з анімацією появи).
export function CtaBar({
  sticky,
  children,
}: {
  sticky?: boolean;
  children: React.ReactNode;
}) {
  if (!sticky) return <div className="mt-auto pb-2 pt-8">{children}</div>;
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-auto bg-gradient-to-t from-cream via-cream/95 to-transparent px-5 pb-2 pt-8 dark:from-night dark:via-night/95">
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
      className="mx-auto block w-full max-w-[440px] rounded-2xl bg-terracotta px-6 py-4 text-center font-heading font-bold text-white shadow-soft transition-colors hover:bg-terracotta-dark disabled:opacity-40 disabled:hover:bg-terracotta"
    >
      {children}
    </button>
  );
}
