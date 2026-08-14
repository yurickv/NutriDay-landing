// components/onboardingPage/OnboardingLayout.tsx
// Обгортка сторінок оплати й auth. Бренд-бук Sytno: крем/night фон,
// картка на bg-card, заголовки Comfortaa (font-heading).
import React from 'react';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  /** Без title секція заголовка не рендериться взагалі. */
  title?: string;
  subtitle?: string;
  /** Широка картка (1128px) — для сторінок із горизонтальними ґрідами (плани оплати). */
  wide?: boolean;
  /** Без спільної картки-фону — коли кожна секція всередині має власну картку. */
  bare?: boolean;
}

export const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  children,
  title,
  subtitle,
  wide = false,
  bare = false,
}) => {
  return (
    <div className="min-h-screen bg-cream font-body text-ink dark:bg-night dark:text-night-ink">
      <main>
        {title && (
          <section className="relative">
            <div className="div-container relative z-10 mx-auto flex flex-col gap-5 py-[44px] text-center md:gap-10">
              <h1 className="mt-14 text-center font-heading text-3xl font-bold md:text-4xl">
                {title}
              </h1>
              {subtitle && (
                <p className="text-lg text-ink/70 dark:text-night-muted">{subtitle}</p>
              )}
            </div>
          </section>
        )}
        <section>
          <div className="div-container mx-auto py-[20px] md:py-[44px]">
            <div className="flex justify-center">
              <div
                className={`flex w-full flex-col ${
                  bare
                    ? ''
                    : 'rounded-3xl bg-card p-8 shadow-soft dark:bg-night-card md:p-12'
                } ${wide ? 'max-w-[1128px]' : 'max-w-[600px]'}`}
              >
                {children}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
