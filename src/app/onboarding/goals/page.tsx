// app/onboarding/goals/page.tsx
'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getOnboardingData } from '@/utils/onboardingHelpers';

export default function Goals() {
  const router = useRouter();

  useEffect(() => {
    // Check if we have calories data from previous step
    const data = getOnboardingData();

    // If no data, redirect back to first page
    if (!data.age || !data.weight || !data.height) {
      router.push('/onboarding');
      return;
    }

    // Redirect to main goal selection
    router.push('/onboarding/main-goal');
  }, [router]);

  return (
    <div className='min-h-screen bg-amber-50 dark:bg-dark-body flex items-center justify-center'>
      <div className='text-center'>
        <div className='relative w-16 h-16 mx-auto'>
          <div className='absolute top-0 left-0 w-full h-full border-4 border-gray-200 rounded-full'></div>
          <div className='absolute top-0 left-0 w-full h-full border-4 border-t-orange-500 rounded-full animate-spin'></div>
        </div>
        <p className='mt-4 text-main-text dark:text-main-text-black'>
          Завантаження...
        </p>
      </div>
    </div>
  );
}
