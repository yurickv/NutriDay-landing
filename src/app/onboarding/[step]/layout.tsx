import { STEPS } from '@/lib/onboarding/steps';

// Кроки квізу — статичний HTML при build: швидкий TTFB на вході у воронку,
// CDN-кешованість, миттєвий prefetch між кроками (див. StepRenderer).
// dynamicParams лишаємо true: сміттєвий ключ обробляє клієнтський редірект
// у StepRenderer (firstUnansweredKey), а не 404.
export function generateStaticParams() {
  return STEPS.map((s) => ({ step: s.key }));
}

export default function OnboardingStepLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
