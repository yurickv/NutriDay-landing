// app/onboarding/goal-reason/page.tsx
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import { RadioButton } from '@/components/onboardingPage/RadioButton';
import { setOnboardingData } from '@/utils/onboardingHelpers';

function GoalReasonContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const goal = searchParams.get('goal');
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [title, setTitle] = useState<string>('');

  useEffect(() => {
    switch (goal) {
      case 'lose_weight':
        setTitle('Чому ви хочете схуднути?');
        break;
      case 'gain_weight':
        setTitle('Чому ви хочете набрати вагу?');
        break;
      case 'build_muscle':
        setTitle("Чому ви хочете наростити м'язи?");
        break;
      default:
        setTitle('Чому ви хочете досягти своєї мети?');
    }
  }, [goal]);

  const handleReasonSelect = (reason: string) => {
    setSelectedReason(reason);
    setOnboardingData('goalReason', reason);

    setTimeout(() => {
      router.push('/onboarding/additional-goal');
    }, 150);
  };

  const reasons = [
    {
      id: 'feel_confident',
      value: 'feel_confident',
      label: '😎 Щоб почуватися впевненіше',
    },
    {
      id: 'improve_wellbeing',
      value: 'improve_wellbeing',
      label: '💚 Щоб поліпшити своє загальне самопочуття',
    },
    {
      id: 'improve_fitness',
      value: 'improve_fitness',
      label: '🏋 Щоб підвищити рівень фізичної форми',
    },
    {
      id: 'special_event',
      value: 'special_event',
      label: '🎊 Щоб підготуватися до особливої події',
    },
    {
      id: 'burn_calories',
      value: 'burn_calories',
      label: '📉 Щоб спалити більше калорій',
    },
    { id: 'something_else', value: 'something_else', label: '💬 Щось інше' },
  ];

  return (
    <OnboardingLayout title={title}>
      <div className='space-y-3'>
        {reasons.map((reason) => (
          <RadioButton
            key={reason.id}
            id={reason.id}
            name='goalReason'
            value={reason.value}
            label={reason.label}
            checked={selectedReason === reason.value}
            onChange={handleReasonSelect}
          />
        ))}
      </div>
    </OnboardingLayout>
  );
}

export default function GoalReason() {
  return (
    <Suspense fallback={null}>
      <GoalReasonContent />
    </Suspense>
  );
}
