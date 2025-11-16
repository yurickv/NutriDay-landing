// app/onboarding/past-challenges/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import { CheckboxButton } from '@/components/onboardingPage/CheckboxButton';
import { setOnboardingData } from '@/utils/onboardingHelpers';

export default function PastChallenges() {
  const router = useRouter();
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);

  const handleChallengeChange = (value: string, checked: boolean) => {
    if (checked) {
      setSelectedChallenges([...selectedChallenges, value]);
    } else {
      setSelectedChallenges(selectedChallenges.filter((c) => c !== value));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedChallenges.length === 0) return;

    setOnboardingData('pastChallenges', selectedChallenges);
    router.push('/onboarding/challenges-overcome');
  };

  const challenges = [
    {
      id: 'stay_motivated',
      value: 'stay_motivated',
      label: '💪 Зберігати мотивацію',
    },
    {
      id: 'eat_quality',
      value: 'eat_quality',
      label: '🍽 Вживати достатню кількість якісних продуктів',
    },
    {
      id: 'enough_protein',
      value: 'enough_protein',
      label: '💪 Отримувати достатню кількість білка',
    },
    {
      id: 'know_what_to_eat',
      value: 'know_what_to_eat',
      label: '🥗 Знати, що їсти',
    },
    { id: 'too_busy', value: 'too_busy', label: '⏰ Занадто зайнятий' },
    { id: 'something_else', value: 'something_else', label: '💬 Щось інше' },
  ];

  return (
    <OnboardingLayout title='З якими труднощами ви зіткнулися?'>
      <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
        <div className='space-y-3'>
          {challenges.map((challenge) => (
            <CheckboxButton
              key={challenge.id}
              id={challenge.id}
              value={challenge.value}
              label={challenge.label}
              checked={selectedChallenges.includes(challenge.value)}
              onChange={handleChallengeChange}
            />
          ))}
        </div>
        <button
          type='submit'
          disabled={selectedChallenges.length === 0}
          className={`mt-6 rounded-xl p-4 text-white text-center block transition-all duration-200
            ${
              selectedChallenges.length > 0
                ? 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 hover:shadow-[0_8px_9px_-4px_rgba(59,113,202,0.3),0_4px_18px_0_rgba(59,113,202,0.2)]'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
        >
          Далі
        </button>
      </form>
    </OnboardingLayout>
  );
}
