// app/onboarding/creating-plan/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import { getOnboardingData } from '@/utils/onboardingHelpers';

export default function CreatingPlan() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const submitData = async () => {
      const data = getOnboardingData();

      // Simulate API call
      setTimeout(async () => {
        try {
          // Here you would make actual API call to your Next.js API route
          const response = await fetch('/api/onboarding', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
          });

          if (response.ok) {
            // Clear local storage after successful submission
            // clearOnboardingData(); // Uncomment when ready

            // Redirect to dashboard or results page
            router.push('/dashboard'); // Update with your actual route
          }
        } catch (error) {
          console.error('Error submitting data:', error);
          setIsLoading(false);
        }
      }, 3000); // Simulate loading for 3 seconds
    };

    submitData();
  }, [router]);

  return (
    <OnboardingLayout title='Створюємо ваш індивідуальний план'>
      <div className='flex flex-col items-center justify-center gap-6 py-8'>
        {isLoading ? (
          <>
            <div className='relative w-24 h-24'>
              <div className='absolute top-0 left-0 w-full h-full border-4 border-gray-200 rounded-full'></div>
              <div className='absolute top-0 left-0 w-full h-full border-4 border-t-orange-500 rounded-full animate-spin'></div>
            </div>
            <p className='text-lg text-main-text dark:text-main-text-black text-center'>
              Аналізуємо ваші відповіді та створюємо персоналізований план
              харчування...
            </p>
            <div className='flex gap-2'>
              <span
                className='w-2 h-2 bg-orange-500 rounded-full animate-bounce'
                style={{ animationDelay: '0ms' }}
              ></span>
              <span
                className='w-2 h-2 bg-orange-500 rounded-full animate-bounce'
                style={{ animationDelay: '150ms' }}
              ></span>
              <span
                className='w-2 h-2 bg-orange-500 rounded-full animate-bounce'
                style={{ animationDelay: '300ms' }}
              ></span>
            </div>
          </>
        ) : (
          <p className='text-lg text-red-500'>
            Щось пішло не так. Спробуйте ще раз.
          </p>
        )}
      </div>
    </OnboardingLayout>
  );
}
