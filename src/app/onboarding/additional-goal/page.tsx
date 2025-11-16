// app/onboarding/additional-goal/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';
import { CheckboxButton } from '@/components/onboardingPage/CheckboxButton';
import {
  setOnboardingData,
  getOnboardingData,
} from '@/utils/onboardingHelpers';

export default function AdditionalGoal() {
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

    setOnboardingData('additionalGoal', selectedGoals);

    const data = getOnboardingData();
    // Navigate based on main goal
    if (data.mainGoal === 'build_muscle') {
      router.push('/onboarding/build-muscle-experience');
    } else if (data.mainGoal === 'lose_weight') {
      router.push('/onboarding/past-experience');
    } else if (data.mainGoal === 'gain_weight') {
      router.push('/onboarding/gain-weight-experience');
    } else {
      router.push('/onboarding/nutrition-knowledge');
    }
  };

  const goals = [
    {
      id: 'improve_food_relationship',
      value: 'improve_food_relationship',
      label: '🍲 Поліпшити своє ставлення до їжі',
    },
    {
      id: 'learn_cooking',
      value: 'learn_cooking',
      label: '🍳 Навчитися готувати здорову їжу',
    },
    {
      id: 'boost_immunity',
      value: 'boost_immunity',
      label: '🍋 Зміцнити імунну систему',
    },
    {
      id: 'better_sleep',
      value: 'better_sleep',
      label: '💤 Краще спати і мати більше енергії',
    },
    {
      id: 'feel_comfortable',
      value: 'feel_comfortable',
      label: '😊 Почуватися комфортно у власній шкірі',
    },
    { id: 'none', value: 'none', label: '❌ Нічого з перерахованого' },
  ];

  return (
    <OnboardingLayout title='Чи є ще щось, чого ви хочете досягти?'>
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
