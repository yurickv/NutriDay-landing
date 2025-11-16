// app/onboarding/short-barriers/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import { CheckboxButton } from '@/components/onboardingPage/CheckboxButton';
import { setOnboardingData } from '@/utils/onboardingHelpers';

export default function ShortBarriers() {
  const router = useRouter();
  const [selectedBarriers, setSelectedBarriers] = useState<string[]>([]);

  const handleBarrierChange = (value: string, checked: boolean) => {
    if (checked) {
      setSelectedBarriers([...selectedBarriers, value]);
    } else {
      setSelectedBarriers(selectedBarriers.filter((b) => b !== value));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBarriers.length === 0) return;

    setOnboardingData('shortBarriers', selectedBarriers);
    router.push('/onboarding/thank-for-trust');
  };

  const barriers = [
    {
      id: 'lack_consistency',
      value: 'lack_consistency',
      label: '🎢 Відсутність послідовності',
    },
    {
      id: 'unhealthy_habits',
      value: 'unhealthy_habits',
      label: '🍟 Нездорові харчові звички',
    },
    {
      id: 'lack_support',
      value: 'lack_support',
      label: '🤝 Відсутність підтримки',
    },
    {
      id: 'busy_schedule',
      value: 'busy_schedule',
      label: '📅 Напружений графік',
    },
    {
      id: 'lack_inspiration',
      value: 'lack_inspiration',
      label: '🥘 Відсутність натхнення для приготування їжі',
    },
  ];

  return (
    <OnboardingLayout title='Що заважає вам досягти своїх цілей?'>
      <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
        <div className='space-y-3'>
          {barriers.map((barrier) => (
            <CheckboxButton
              key={barrier.id}
              id={barrier.id}
              value={barrier.value}
              label={barrier.label}
              checked={selectedBarriers.includes(barrier.value)}
              onChange={handleBarrierChange}
            />
          ))}
        </div>
        <button
          type='submit'
          disabled={selectedBarriers.length === 0}
          className={`mt-6 rounded-xl p-4 text-white text-center block transition-all duration-200
            ${
              selectedBarriers.length > 0
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
