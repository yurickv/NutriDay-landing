import { redirect } from 'next/navigation';
import { STEPS } from '@/lib/onboarding/steps';

// onboarding_started тепер стріляє StepRenderer на першому кроці.
export default function OnboardingIndex() {
  redirect(`/onboarding/${STEPS[0].key}`);
}
