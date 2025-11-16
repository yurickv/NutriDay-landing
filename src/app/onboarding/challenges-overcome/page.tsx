// app/onboarding/challenges-overcome/page.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';

export default function ChallengesOvercome() {
  const router = useRouter();

  const handleContinue = () => {
    router.push('/onboarding/changes-role-model');
  };

  return (
    <OnboardingLayout title='Ми допоможемо вам у цьому.'>
      <div className='flex flex-col gap-6'>
        <p className='text-lg text-main-text dark:text-main-text-black leading-relaxed'>
          Нарощування м'язів може бути складним завданням, але ми знаємо, що ви
          зможете це зробити. Ми будемо супроводжувати вас на кожному етапі,
          надаючи все необхідне для досягнення ваших цілей.
        </p>
        <button
          onClick={handleContinue}
          className='mt-6 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 
            rounded-xl p-4 text-white text-center block transition-all duration-200
            hover:shadow-[0_8px_9px_-4px_rgba(59,113,202,0.3),0_4px_18px_0_rgba(59,113,202,0.2)]'
        >
          Поїхали
        </button>
      </div>
    </OnboardingLayout>
  );
}
