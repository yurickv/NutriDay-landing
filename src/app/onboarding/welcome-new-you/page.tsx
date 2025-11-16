// app/onboarding/welcome-new-you/page.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';

export default function WelcomeNewYou() {
  const router = useRouter();

  const handleContinue = () => {
    router.push('/onboarding/short-goal');
  };

  return (
    <OnboardingLayout title='Почніть свій шлях зараз'>
      <div className='flex flex-col gap-6'>
        <ul className='space-y-4 text-lg'>
          <li className='flex items-start gap-3'>
            <span className='text-2xl'>🔬</span>
            <span className='text-main-text dark:text-main-text-black'>
              Ми використовуємо наукові дані, щоб допомогти вам досягти ваших
              цілей у сфері здоров'я.
            </span>
          </li>
          <li className='flex items-start gap-3'>
            <span className='text-2xl'>🔗</span>
            <span className='text-main-text dark:text-main-text-black'>
              Створено фахівцями фітнес індустрії з 10+ років досвіду
            </span>
          </li>
          <li className='flex items-start gap-3'>
            <span className='text-2xl'>🍏</span>
            <span className='text-main-text dark:text-main-text-black'>
              Використання AI для персоналізації меню і доступу до рецептів зі
              всього світу
            </span>
          </li>
        </ul>
        <button
          onClick={handleContinue}
          className='mt-6 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 
            rounded-xl p-4 text-white text-center block transition-all duration-200
            hover:shadow-[0_8px_9px_-4px_rgba(59,113,202,0.3),0_4px_18px_0_rgba(59,113,202,0.2)]'
        >
          Зрозуміло
        </button>
      </div>
    </OnboardingLayout>
  );
}
