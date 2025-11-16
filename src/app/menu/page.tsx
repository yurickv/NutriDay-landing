'use client';

import React from 'react';
import { OnboardingLayout } from '@/components/onboardingPage/OnboardingLayout';

export default function MenuPage() {
  return (
    <OnboardingLayout
      title="Ваше меню (заглушка)"
      subtitle="Сторінка кабінету ще в розробці"
    >
      <div className="flex flex-col items-center justify-center gap-4 py-10">
        <p className="text-main-text dark:text-main-text-black text-center">
          Тут буде особистий кабінет із вашим денним раціоном,
          рекомендаціями та іншими плюшками.
        </p>
        <p className="text-sm text-gray-500 text-center max-w-md">
          Зараз це тимчасова заглушка. Після першого входу за магічним
          посиланням ви завжди зможете повернутися сюди через пункт
          «Меню» у верхньому меню.
        </p>
      </div>
    </OnboardingLayout>
  );
}

