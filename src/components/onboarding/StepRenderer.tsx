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
import type { Step } from '@/lib/onboarding/types';

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
// Повний предекод (хвиля 2) запускається один раз за сесію.
let fullPredecodeDone = false;
// Браузер дедуплікує повторні запити по кешу, тож повторні виклики дешеві.
const decodedSrcs = new Set<string>();

function stepImageSrcs(s: Step): string[] {
  return [
    s.image?.src,
    s.headerImage?.src,
    ...(s.options ?? []).map((o) => o.image),
    ...Object.values(s.variants ?? {}).map((v) => v.image?.src),
  ].filter((src): src is string => Boolean(src));
}

function decodeImages(srcs: string[]): void {
  for (const src of srcs) {
    if (decodedSrcs.has(src)) continue;
    decodedSrcs.add(src);
    const img = new Image();
    img.src = src;
    img.decode?.().catch(() => {});
  }
}

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

  // Предекодування картинок у ДВІ хвилі, щоб не конкурувати з LCP першого
  // екрана: одразу — лише поточний крок + 2 наступні; решту (включно з фото
  // експертів) — в idle. AVIF не вискакує посеред анімації появи кроку,
  // а на back-навігації малюється одразу з кешу.
  useEffect(() => {
    const idx = STEPS.findIndex((s) => s.key === stepKey);
    if (idx !== -1) {
      decodeImages(STEPS.slice(idx, idx + 3).flatMap(stepImageSrcs));
    }
    if (fullPredecodeDone) return;
    fullPredecodeDone = true;
    const decodeRest = () => {
      decodeImages([
        ...STEPS.flatMap(stepImageSrcs),
        ...EXPERTS.map((e) => e.photo),
      ]);
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(decodeRest, { timeout: 2500 });
    } else {
      setTimeout(decodeRest, 2500);
    }
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

  // onboarding_step_view — один раз на ключ (Set модульний: переживає ремаунти).
  useEffect(() => {
    if (!ready || !accessible || !step || trackedStepViews.has(stepKey)) return;
    trackedStepViews.add(stepKey);
    const index = visibleSteps(answers).findIndex((s) => s.key === stepKey);
    track('onboarding_step_view', { key: stepKey, index, group: step.group });
  }, [ready, accessible, answers, step, stepKey]);

  // Prefetch RSC-payload сусідніх кроків: router.push без <Link> сам нічого
  // не префетчить, тож без цього кожен перехід чекає мережевий запит.
  // next залежить від відповіді на ПОТОЧНОМУ кроці, тому для розгалужених
  // кроків це прогноз по поточних answers — влучає в основний шлях.
  useEffect(() => {
    if (!ready || !accessible) return;
    const next = nextStepKey(stepKey, answers);
    const prev = prevStepKey(stepKey, answers);
    if (next) router.prefetch(`/onboarding/${next}`);
    if (prev) router.prefetch(`/onboarding/${prev}`);
  }, [ready, accessible, stepKey, answers, router]);

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
    content = (
      <InfoScreen
        step={step}
        title={step.wide ? info?.title ?? step.title : undefined}
        body={info?.body}
        image={info?.image}
        onNext={goNext}
      />
    );
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
      wide={step.wide}
      hideHeading={Boolean(step.wide) && step.type === 'info'}
    >
      {isFirst && <TrackEvent event="onboarding_started" withUtmSource />}
      {content}
      {step.key === 'gender' && (
        <p className="mt-6 text-xs leading-relaxed text-ink/50 dark:text-night-muted">
          Вибравши свою стать і продовживши, ви погоджуєтеся з нашими{' '}
          <a
            href="/oferta"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-ink dark:hover:text-night-ink"
          >
            Умовами надання послуг
          </a>{' '}
          та{' '}
          <a
            href="/oferta"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-ink dark:hover:text-night-ink"
          >
            публічною офертою
          </a>
          . Будь ласка, ознайомтеся з ними, перш ніж продовжувати.
        </p>
      )}
    </QuizLayout>
  );
}
