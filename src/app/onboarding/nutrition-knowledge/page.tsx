// app/onboarding/nutrition-knowledge/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import { RadioButton } from '@/components/onboardingPage/RadioButton';
import { setOnboardingData } from '@/utils/onboardingHelpers';

export default function NutritionKnowledge() {
  const router = useRouter();
  const [selectedLevel, setSelectedLevel] = useState<string>('');

  const handleLevelSelect = (level: string) => {
    setSelectedLevel(level);
    setOnboardingData('nutritionKnowledge', level);

    setTimeout(() => {
      router.push('/onboarding/short-barriers');
    }, 150);
  };

  const levels = [
    {
      id: 'beginner',
      value: 'beginner',
      label:
        '🌱 Початківець. Я нічого не знаю про харчування і потребую допомоги, щоб почати.',
    },
    {
      id: 'intermediate',
      value: 'intermediate',
      label:
        '🙂 Середній рівень. Я трохи знаю про харчування, але потребую більш структурованого підходу та контролю над своїм раціоном.',
    },
    {
      id: 'advanced',
      value: 'advanced',
      label:
        '😎 Просунутий рівень. Я багато знаю про харчування і просто хочу вдосконалити свої харчові звички.',
    },
  ];

  return (
    <OnboardingLayout title='Скільки ви знаєте про здорове харчування?'>
      <div className='space-y-3'>
        {levels.map((level) => (
          <RadioButton
            key={level.id}
            id={level.id}
            name='nutritionKnowledge'
            value={level.value}
            label={level.label}
            checked={selectedLevel === level.value}
            onChange={handleLevelSelect}
          />
        ))}
      </div>
    </OnboardingLayout>
  );
}
