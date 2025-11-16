// app/onboarding/gain-weight-experience/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import { RadioButton } from '@/components/onboardingPage/RadioButton';
import { setOnboardingData } from '@/utils/onboardingHelpers';

export default function GainWeightExperience() {
  const router = useRouter();
  const [selectedExperience, setSelectedExperience] = useState<string>('');

  const handleExperienceSelect = (experience: string) => {
    setSelectedExperience(experience);
    setOnboardingData('gainWeightExperience', experience);

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
      id: 'gained_before_more',
      value: 'gained_before_more',
      label: '📈 Я вже набирав вагу раніше і хочу набрати ще більше.',
    },
    {
      id: 'tried_unsuccessfully',
      value: 'tried_unsuccessfully',
      label: '➡ Я раніше намагався набрати вагу, але мені це не вдалося.',
    },
    {
      id: 'gained_then_lost',
      value: 'gained_then_lost',
      label: '↔ Я раніше набирав вагу, але потім знову її втрачав.',
    },
    {
      id: 'never_tried',
      value: 'never_tried',
      label: '💡 Я ніколи раніше не намагався набрати вагу.',
    },
  ];

  return (
    <OnboardingLayout title='Який досвід ви маєте щодо набору ваги?'>
      <div className='space-y-3'>
        {experiences.map((exp) => (
          <RadioButton
            key={exp.id}
            id={exp.id}
            name='gainWeightExperience'
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
