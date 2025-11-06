// app/onboarding/short-goal/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import { CheckboxButton } from '@/components/onboardingPage/CheckboxButton';
import { setOnboardingData } from '@/utils/onboardingHelpers';

export default function ShortGoal() {
  const router = useRouter();
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  const handleGoalChange = (value: string, checked: boolean) => {
    if (checked) {
      setSelectedGoals([...selectedGoals, value]);
    } else {
      setSelectedGoals(selectedGoals.filter((g) => g !== value));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedGoals.length === 0) return;

    setOnboardingData('shortGoal', selectedGoals);
    router.push('/onboarding/nutrition-knowledge');
  };

  const goals = [
    {
      id: 'balanced_eating',
      value: 'balanced_eating',
      label: '🍏 Збалансовано харчуватися і жити здоровіше',
    },
    {
      id: 'boost_energy',
      value: 'boost_energy',
      label: '☀ Підвищити енергію і настрій',
    },
    {
      id: 'stay_motivated',
      value: 'stay_motivated',
      label: '💪 Залишатися мотивованим і послідовним',
    },
    {
      id: 'better_body_image',
      value: 'better_body_image',
      label: '🧘 Краще ставитися до свого тіла',
    },
    {
      id: 'meal_planning',
      value: 'meal_planning',
      label: '🍽 Не думати що приготувати завтра',
    },
  ];

  return (
    <OnboardingLayout title='Що ще ви хотіли б досягти?'>
      <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
        <div className='space-y-3'>
          {goals.map((goal) => (
            <CheckboxButton
              key={goal.id}
              id={goal.id}
              value={goal.value}
              label={goal.label}
              checked={selectedGoals.includes(goal.value)}
              onChange={handleGoalChange}
            />
          ))}
        </div>
        <button
          type='submit'
          disabled={selectedGoals.length === 0}
          className={`mt-6 rounded-xl p-4 text-white text-center block transition-all duration-200
            ${
              selectedGoals.length > 0
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
