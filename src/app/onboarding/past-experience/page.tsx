'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import { RadioButton } from '@/components/onboardingPage/RadioButton';
import { setOnboardingData } from '@/utils/onboardingHelpers';

export default function PastExperience() {
  const router = useRouter();
  const [selectedExperience, setSelectedExperience] = useState<string>('');

  const handleExperienceSelect = (experience: string) => {
    setSelectedExperience(experience);
    setOnboardingData('pastExperience', experience);

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
      id: 'lost_before_more',
      value: 'lost_before_more',
      label: '↘ Я вже схуднула раніше і хочу схуднути ще більше.',
    },
    {
      id: 'tried_unsuccessfully',
      value: 'tried_unsuccessfully',
      label: '➡ Я вже намагалась схуднути раніше, але не вдалося.',
    },
    {
      id: 'lost_then_gained',
      value: 'lost_then_gained',
      label: '↔ Я вже схуднула раніше, але знову набрала вагу.',
    },
    {
      id: 'never_tried',
      value: 'never_tried',
      label: '💡 Я ніколи раніше не намагалась схуднути.',
    },
  ];

  return (
    <OnboardingLayout title='Який досвід ви маєте у сфері схуднення?'>
      <div className='space-y-3'>
        {experiences.map((exp) => (
          <RadioButton
            key={exp.id}
            id={exp.id}
            name='pastExperience'
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
