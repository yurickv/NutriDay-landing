'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STEPS, getStep } from '@/lib/onboarding/steps';
import {
  firstUnansweredKey,
  isAccessible,
  nextStepKey,
  prevStepKey,
  questionProgress,
  resolveInfoContent,
  showHint,
  visibleSteps,
  type Answers,
} from '@/lib/onboarding/engine';
import { getOnboardingData, setOnboardingData } from '@/utils/onboardingHelpers';
import { track } from '@/lib/analytics';
import { TrackEvent } from '@/components/analytics/TrackEvent';
import { QuizLayout } from './QuizLayout';
import { QuestionSingle } from './QuestionSingle';
import { QuestionMulti } from './QuestionMulti';
import { QuestionNumber } from './QuestionNumber';
import { InfoScreen } from './InfoScreen';
import { HowWeCountScreen } from './HowWeCountScreen';
import { ProfileSummaryScreen } from './ProfileSummaryScreen';
import { LoaderScreen } from './LoaderScreen';

// Тривалість вихідної анімації кроку — синхронно з .quiz-step-leave у globals.css.
const LEAVE_MS = 200;

export function StepRenderer({ stepKey }: { stepKey: string }) {
  const router = useRouter();
  // null = ще не читали localStorage (перший клієнтський рендер).
  const [answers, setAnswers] = useState<Answers | null>(null);
  const trackedKeys = useRef<Set<string>>(new Set());
  // Вихідна анімація: спершу фейд контенту, потім router.push.
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);

  // Скидання ПІД ЧАС рендеру, а не в ефекті: інакше перший кадр нового кроку
  // малюється з .quiz-step-leave (opacity 1) — контент блимає перед появою.
  const [renderedKey, setRenderedKey] = useState(stepKey);
  if (renderedKey !== stepKey) {
    setRenderedKey(stepKey);
    leavingRef.current = false;
    setLeaving(false);
  }

  useEffect(() => {
    setAnswers(getOnboardingData() as Answers);
  }, [stepKey]);

  const step = getStep(stepKey);
  const ready = answers !== null;
  const accessible = ready && !!step && isAccessible(stepKey, answers);

  // Невідомий або ще недоступний ключ → перший незаповнений крок.
  useEffect(() => {
    if (ready && !accessible) {
      router.replace(`/onboarding/${firstUnansweredKey(answers)}`);
    }
  }, [ready, accessible, answers, router]);

  // onboarding_step_view — один раз на ключ.
  useEffect(() => {
    if (!ready || !accessible || !step || trackedKeys.current.has(stepKey)) return;
    trackedKeys.current.add(stepKey);
    const index = visibleSteps(answers).findIndex((s) => s.key === stepKey);
    track('onboarding_step_view', { key: stepKey, index, group: step.group });
  }, [ready, accessible, answers, step, stepKey]);

  if (!ready || !step || !accessible) return null; // редірект у польоті

  const goTo = (key: string | null) => {
    if (!key || leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(true);
    setTimeout(() => router.push(`/onboarding/${key}`), LEAVE_MS);
  };

  const saveAnswer = (field: string, value: unknown) => {
    setOnboardingData(field, value);
    const next = { ...answers, [field]: value };
    setAnswers(next);
    goTo(nextStepKey(stepKey, next));
  };

  const goNext = () => goTo(nextStepKey(stepKey, answers));

  const handleProfileDone = (email: string) => {
    setOnboardingData('email', email);
    setOnboardingData('personalDataConsent', true);
    const next = { ...answers, email, personalDataConsent: true };
    setAnswers(next);
    goTo(nextStepKey(stepKey, next));
  };

  const visible = visibleSteps(answers);
  const stepIndex = visible.findIndex((s) => s.key === stepKey);
  const progressPct = ((stepIndex + 1) / visible.length) * 100;
  const progress = step.type === 'question' ? questionProgress(stepKey, answers) : null;
  const info = step.type === 'info' ? resolveInfoContent(step, answers) : null;
  const isFirst = stepKey === STEPS[0].key;
  const prev = prevStepKey(stepKey, answers);
  const onBack =
    step.type === 'loader' || isFirst || !prev ? undefined : () => goTo(prev);

  let content: React.ReactNode;
  if (step.type === 'loader') {
    content = <LoaderScreen />;
  } else if (step.key === 'how_we_count') {
    content = <HowWeCountScreen answers={answers} onNext={goNext} />;
  } else if (step.key === 'your_profile') {
    content = (
      <ProfileSummaryScreen step={step} answers={answers} onDone={handleProfileDone} />
    );
  } else if (step.type === 'info') {
    content = <InfoScreen step={step} body={info?.body} onNext={goNext} />;
  } else if (step.questionType === 'single') {
    content = (
      <QuestionSingle
        key={stepKey}
        step={step}
        value={answers[step.field!] as string | undefined}
        onAnswer={(v) => saveAnswer(step.field!, v)}
      />
    );
  } else if (step.questionType === 'multi') {
    content = (
      <QuestionMulti
        key={stepKey}
        step={step}
        value={answers[step.field!] as string[] | undefined}
        onAnswer={(v) => saveAnswer(step.field!, v)}
      />
    );
  } else {
    content = (
      <QuestionNumber
        key={stepKey}
        step={step}
        value={answers[step.field!] as string | undefined}
        onAnswer={(v) => saveAnswer(step.field!, v)}
      />
    );
  }

  return (
    <QuizLayout
      title={info?.title ?? step.title}
      hint={showHint(step, answers) ? step.hint : undefined}
      progress={progress}
      progressPct={progressPct}
      onBack={onBack}
      animationKey={stepKey}
      leaving={leaving}
    >
      {isFirst && <TrackEvent event="onboarding_started" withUtmSource />}
      {content}
    </QuizLayout>
  );
}
