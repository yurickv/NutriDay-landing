// app/onboarding/main-goal/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import { RadioButton } from '@/components/onboardingPage/RadioButton';
import { setOnboardingData } from '@/utils/onboardingHelpers';

export default function MainGoal() {
  const router = useRouter();
  const [selectedGoal, setSelectedGoal] = useState<string>('');

  const handleGoalSelect = (goal: string) => {
    setSelectedGoal(goal);
    setOnboardingData('mainGoal', goal);

    // Navigate based on selection
    setTimeout(() => {
      switch (goal) {
        case 'lose_weight':
          router.push('/onboarding/goal-reason?goal=lose_weight');
          break;
        case 'maintain_weight':
          router.push('/onboarding/welcome-new-you');
          break;
        case 'gain_weight':
          router.push('/onboarding/goal-reason?goal=gain_weight');
          break;
        case 'build_muscle':
          router.push('/onboarding/goal-reason?goal=build_muscle');
          break;
        case 'something_else':
          router.push('/onboarding/welcome-new-you');
          break;
      }
    }, 150); // Small delay for visual feedback
  };

  const goals = [
    { id: 'lose_weight', value: 'lose_weight', label: '📉 Схуднути' },
    {
      id: 'maintain_weight',
      value: 'maintain_weight',
      label: '👀 Підтримувати вагу',
    },
    { id: 'gain_weight', value: 'gain_weight', label: '📈 Набрати вагу' },
    { id: 'build_muscle', value: 'build_muscle', label: "💪 Наростити м'язи" },
    { id: 'something_else', value: 'something_else', label: '💬 Щось інше' },
  ];

  return (
    <OnboardingLayout title='Яка ваша головна мета?'>
      <div className='space-y-3'>
        {goals.map((goal) => (
          <RadioButton
            key={goal.id}
            id={goal.id}
            name='mainGoal'
            value={goal.value}
            label={goal.label}
            checked={selectedGoal === goal.value}
            onChange={handleGoalSelect}
          />
        ))}
      </div>
    </OnboardingLayout>
  );
}
