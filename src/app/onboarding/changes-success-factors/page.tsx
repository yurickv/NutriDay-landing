// app/onboarding/changes-success-factors/page.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';

export default function ChangesSuccessFactors() {
  const router = useRouter();

  const handleContinue = () => {
    router.push('/onboarding/thank-for-trust');
  };

  return (
    <OnboardingLayout title='Ви теж можете це зробити!'>
      <div className='flex flex-col gap-6'>
        <p className='text-lg text-main-text dark:text-main-text-black leading-relaxed'>
          Існує кілька факторів, які відіграють важливу роль у досягненні
          успіху. Хоча сила волі та психічна стійкість можуть бути важливими,
          надійний план і надійна система підтримки є абсолютно необхідними.
          Саме для цього зараз у вас є EasyMenu.
        </p>
        <button
          onClick={handleContinue}
          className='mt-6 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 
            rounded-xl p-4 text-white text-center block transition-all duration-200
            hover:shadow-[0_8px_9px_-4px_rgba(59,113,202,0.3),0_4px_18px_0_rgba(59,113,202,0.2)]'
        >
          Я не можу чекати
        </button>
      </div>
    </OnboardingLayout>
  );
}
