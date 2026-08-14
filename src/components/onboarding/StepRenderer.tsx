'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GROUP_LABELS, STEPS, getStep } from '@/lib/onboarding/steps';
import {
  firstUnansweredKey,
  isAccessible,
  nextStepKey,
  prevStepKey,
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
import { EXPERTS, InfoScreen } from './InfoScreen';
import { HowWeCountScreen } from './HowWeCountScreen';
import { ProfileSummaryScreen } from './ProfileSummaryScreen';
import { LoaderScreen } from './LoaderScreen';

// Тривалість вихідної анімації кроку — синхронно з transition у StepTransition.
const LEAVE_MS = 200;

// App Router РЕМАУНТИТЬ page-компонент на кожну зміну [step], тож ці значення
// живуть на рівні модуля, щоб переживати переходи між кроками:
// - hydrated: після першого клієнтського маунту можна читати localStorage
//   синхронно в ініціалізаторі стейту — без проміжного null-рендеру, який
//   на кадр прибирав увесь лейаут (біле блимання при переході);
// - trackedStepViews: дедуплікація onboarding_step_view між ремаунтами.
let hydrated = false;
const trackedStepViews = new Set<string>();

export function StepRenderer({ stepKey }: { stepKey: string }) {
  const router = useRouter();
  // null лише під час SSR/гідрації першого завантаження (сервер і клієнт
  // мусять відрендерити однаково); при клієнтських переходах — одразу дані.
  const [answers, setAnswers] = useState<Answers | null>(() =>
    hydrated ? (getOnboardingData() as Answers) : null
  );
  // Вихідна анімація: спершу фейд контенту, потім router.push.
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);

  useEffect(() => {
    hydrated = true;
    setAnswers((prev) => prev ?? (getOnboardingData() as Answers));
  }, []);

  // Предекодування всіх картинок квізу: AVIF не вискакує посеред анімації
  // появи кроку, а на back-навігації малюється одразу з кешу.
  useEffect(() => {
    const srcs = STEPS.flatMap((s) => [
      s.image?.src,
      s.headerImage?.src,
      ...(s.options ?? []).map((o) => o.image),
    ]).filter((src): src is string => Boolean(src));
    srcs.push(...EXPERTS.map((e) => e.photo));
    for (const src of srcs) {
      const img = new Image();
      img.src = src;
      img.decode?.().catch(() => {});
    }
  }, []);

  const step = getStep(stepKey);
  const ready = answers !== null;
  const accessible = ready && !!step && isAccessible(stepKey, answers);

  // Невідомий або ще недоступний ключ → перший незаповнений крок.
  useEffect(() => {
    if (ready && !accessible) {
      router.replace(`/onboarding/${firstUnansweredKey(answers)}`);
    }
  }, [ready, accessible, answers, router]);

  // onboarding_step_view — один раз на ключ (Set модульний: переживає ремаунти).
  useEffect(() => {
    if (!ready || !accessible || !step || trackedStepViews.has(stepKey)) return;
    trackedStepViews.add(stepKey);
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
      groupLabel={GROUP_LABELS[step.group]}
      progressPct={progressPct}
      image={step.headerImage}
      onBack={onBack}
      animationKey={stepKey}
      leaving={leaving}
    >
      {isFirst && <TrackEvent event="onboarding_started" withUtmSource />}
      {content}
    </QuizLayout>
  );
}
