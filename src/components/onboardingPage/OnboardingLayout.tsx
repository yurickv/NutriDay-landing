// components/onboarding/OnboardingLayout.tsx
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
    <div className='min-h-screen bg-white dark:bg-dark-body'>
      <main className='text-[#21201C] dark:text-main-title-black'>
        <section className='relative'>
          <div className='div-container py-[44px] mx-auto text-center flex flex-col gap-5 md:gap-10 z-10 relative bg-white dark:bg-dark-body'>
            <h1 className='text-3xl md:text-4xl font-bold text-center mt-14 text-main-title dark:text-main-title-black'>
              {title}
            </h1>
            {subtitle && (
              <p className='text-lg text-main-text dark:text-main-text-black'>
                {subtitle}
              </p>
            )}
          </div>
        </section>
        <section className='bg-white dark:bg-dark-body'>
          <div className='div-container py-[20px] md:py-[44px] mx-auto'>
            <div className='flex justify-center'>
              <div className='p-8 md:p-12 bg-[#F5F5F5] dark:bg-[#676465] flex flex-col max-w-[600px] w-full rounded-xl shadow-[0px_4px_20px_0px_rgba(133,119,123,0.30)] dark:shadow-[0px_4px_15px_0px_rgba(116,116,116,0.30)]'>
                {children}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
