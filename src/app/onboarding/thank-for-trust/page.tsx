// app/onboarding/thank-for-trust/page.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';

export default function ThankForTrust() {
  const router = useRouter();

  const handleCreateMenu = () => {
    router.push('/onboarding/creating-plan');
  };

  return (
    <OnboardingLayout title='Дякуємо за довіру.'>
      <div className='flex flex-col gap-6'>
        <p className='text-lg text-main-text dark:text-main-text-black leading-relaxed'>
          Ми дуже цінуємо вашу відкритість і чесність. На основі інформації, яку
          ви нам надали, ми створимо для вас індивідуальний план. І є одна річ,
          яку ми знаємо ще до того, як він буде готовий: ви зможете це зробити!
        </p>
        <button
          onClick={handleCreateMenu}
          className='mt-6 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 
            rounded-xl p-4 text-white text-center block transition-all duration-200
            hover:shadow-[0_8px_9px_-4px_rgba(59,113,202,0.3),0_4px_18px_0_rgba(59,113,202,0.2)]'
        >
          Створити моє меню
        </button>
      </div>
    </OnboardingLayout>
  );
}
