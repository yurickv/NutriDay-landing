// app/onboarding/changes-role-model/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import { RadioButton } from '@/components/onboardingPage/RadioButton';
import { setOnboardingData } from '@/utils/onboardingHelpers';

export default function ChangesRoleModel() {
  const router = useRouter();
  const [selectedFactor, setSelectedFactor] = useState<string>('');

  const handleFactorSelect = (factor: string) => {
    setSelectedFactor(factor);
    setOnboardingData('roleModel', factor);

    setTimeout(() => {
      router.push('/onboarding/changes-success-factors');
    }, 150);
  };

  const factors = [
    { id: 'willpower', value: 'willpower', label: '✊ Внутрішня сила волі' },
    {
      id: 'structure',
      value: 'structure',
      label: '📐 Структура та планування',
    },
    {
      id: 'healthy_habits',
      value: 'healthy_habits',
      label: '🍎 Здорові звички',
    },
    {
      id: 'support_system',
      value: 'support_system',
      label: '🤝 Хороша система підтримки',
    },
    { id: 'dont_know', value: 'dont_know', label: '❓ Не знаю' },
  ];

  return (
    <OnboardingLayout title='Подумайте про когось із ваших знайомих, хто досяг своєї мети. У чому полягав секрет його успіху?'>
      <div className='space-y-3'>
        {factors.map((factor) => (
          <RadioButton
            key={factor.id}
            id={factor.id}
            name='roleModel'
            value={factor.value}
            label={factor.label}
            checked={selectedFactor === factor.value}
            onChange={handleFactorSelect}
          />
        ))}
      </div>
    </OnboardingLayout>
  );
}
