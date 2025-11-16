import { OnboardingData } from '@/types/onboarding';

// utils/onboardingHelpers.ts
export const setOnboardingData = (key: string, value: any) => {
  const existingData = localStorage.getItem('onboardingData');
  const data = existingData ? JSON.parse(existingData) : {};
  data[key] = value;
  localStorage.setItem('onboardingData', JSON.stringify(data));
};

export const getOnboardingData = (): OnboardingData => {
  const data = localStorage.getItem('onboardingData');
  return data ? JSON.parse(data) : {};
};

export const clearOnboardingData = () => {
  localStorage.removeItem('onboardingData');
};
