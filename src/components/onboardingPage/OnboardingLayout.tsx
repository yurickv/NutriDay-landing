// components/onboardingPage/OnboardingLayout.tsx
// Обгортка сторінок оплати й auth. Бренд-бук NutriDay: крем/night фон,
// картка на bg-card, заголовки Comfortaa (font-heading).
import React from 'react';

interface OnboardingLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  children,
  title,
  subtitle,
}) => {
  return (
    <div className="min-h-screen bg-cream font-body text-ink dark:bg-night dark:text-night-ink">
      <main>
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
        <section>
          <div className="div-container mx-auto py-[20px] md:py-[44px]">
            <div className="flex justify-center">
              <div className="flex w-full max-w-[600px] flex-col rounded-3xl bg-card p-8 shadow-soft dark:bg-night-card md:p-12">
                {children}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
