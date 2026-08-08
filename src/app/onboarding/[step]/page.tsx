'use client';

import { use } from 'react';
import { StepRenderer } from '@/components/onboarding/StepRenderer';

// Next 15: params у клієнтській сторінці — Promise, розпаковуємо через use().
export default function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = use(params);
  return <StepRenderer stepKey={step} />;
}
