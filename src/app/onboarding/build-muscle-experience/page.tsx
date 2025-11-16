// app/onboarding/build-muscle-experience/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import { RadioButton } from '@/components/onboardingPage/RadioButton';
import { setOnboardingData } from '@/utils/onboardingHelpers';

export default function BuildMuscleExperience() {
  const router = useRouter();
  const [selectedExperience, setSelectedExperience] = useState<string>('');

  const handleExperienceSelect = (experience: string) => {
    setSelectedExperience(experience);
    setOnboardingData('buildMuscleExperience', experience);

    setTimeout(() => {
      if (experience === 'never_tried') {
        router.push('/onboarding/changes-role-model');
      } else {
        router.push('/onboarding/past-challenges');
      }
    }, 150);
  };

  const experiences = [
    {
      id: 'built_before_more',
      value: 'built_before_more',
      label: "↗ Я вже нарощував м'язи раніше і хочу наростити ще більше.",
    },
    {
      id: 'tried_unsuccessfully',
      value: 'tried_unsuccessfully',
      label: "➡ Я вже намагався наростити м'язи раніше, але безуспішно.",
    },
    {
      id: 'built_then_lost',
      value: 'built_then_lost',
      label: "↔ Я вже нарощував м'язи раніше, але знову їх втрачав.",
    },
    {
      id: 'never_tried',
      value: 'never_tried',
      label: "💡 Я ніколи раніше не намагався наростити м'язи.",
    },
  ];

  return (
    <OnboardingLayout title="Який досвід ви маєте у нарощуванні м'язової маси?">
      <div className='space-y-3'>
        {experiences.map((exp) => (
          <RadioButton
            key={exp.id}
            id={exp.id}
            name='buildMuscleExperience'
            value={exp.value}
            label={exp.label}
            checked={selectedExperience === exp.value}
            onChange={handleExperienceSelect}
          />
        ))}
      </div>
    </OnboardingLayout>
  );
}
