'use client';

import { useState } from 'react';
import { Smartphone } from 'lucide-react';
import type { Step } from '@/lib/onboarding/types';
import { CtaBar, QuizCta } from './QuizLayout';

interface Props {
  step: Step;
  /** Заголовок (лише для wide-кроків — QuizLayout тоді свій h1 не рендерить). */
  title?: string;
  /** Текст, уже резолвлений через resolveInfoContent (variants + bodyShort). */
  body?: string;
  onNext: () => void;
}

export function InfoScreen({ step, title, body, onNext }: Props) {
  // Wide: дві половини — текст зліва (вертикально по центру), фото справа.
  // На мобільному колонки складаються у звичний стовпчик.
  if (step.wide) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex flex-1 flex-col md:flex-row md:items-center md:gap-10">
          <div className="mt-8 flex flex-col justify-center md:mt-0 md:w-1/2">
            {title && (
              <h1 className="font-heading text-[28px] font-bold leading-snug md:text-[32px]">
                {title}
              </h1>
            )}
            {body && (
              <p className="mt-4 text-[17px] leading-relaxed text-ink/80 dark:text-night-ink/80">
                {body}
              </p>
            )}
          </div>
          {step.image && (
            <div className="mt-6 md:mt-0 md:w-1/2">
              <QuizImage image={step.image} />
            </div>
          )}
        </div>
        <CtaBar sticky={step.stickyCta}>
          <QuizCta onClick={onNext}>Продовжити</QuizCta>
        </CtaBar>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {body && (
        <p className="text-[17px] leading-relaxed text-ink/80 dark:text-night-ink/80">{body}</p>
      )}
      {step.image && (
        <div className="mt-6">
          <QuizImage image={step.image} />
        </div>
      )}
      {step.key === 'expert' && <ExpertsCard />}
      <CtaBar sticky={step.stickyCta}>
        <QuizCta onClick={onNext}>Продовжити</QuizCta>
      </CtaBar>
    </div>
  );
}

// Скріни з застосунку (B5, B9) можуть ще не існувати — тоді м'який placeholder.
function QuizImage({ image }: { image: { src: string; alt: string } }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="mx-auto flex h-48 w-full max-w-[640px] items-center justify-center rounded-3xl bg-sage-light/40 dark:bg-night-card">
        <Smartphone
          className="h-12 w-12 text-sage-dark dark:text-sage-light"
          strokeWidth={1.5}
          aria-hidden
        />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.src}
      alt={image.alt}
      onError={() => setFailed(true)}
      // max-w: фото не розтягується на всю wide-колонку (1128px);
      // max-h + object-cover: повна ширина колонки, висота обмежена екраном —
      // високі фото (колаж на goal_promise) обрізаються зверху/знизу, не скролять.
      className="mx-auto max-h-[55dvh] w-full max-w-[640px] rounded-3xl object-cover shadow-soft"
    />
  );
}

// B13. Експерти: фото в public/onboarding/; якщо файлу немає — ініціали.
export const EXPERTS = [
  {
    name: 'Юрій Теслюк',
    role: 'Персональний тренер, нутриціолог',
    photo: '/onboarding/expert.avif',
    initials: 'ЮТ',
    details: [],
  },
  {
    name: 'Довгань Оксана',
    role: 'Фітнес тренер, експерт з харчування',
    photo: '/onboarding/expert1.avif',
    initials: 'ОД',
    details: [],
  },
  {
    name: 'Олена Полівода',
    role: 'Фітнес тренер, нутриціолог',
    photo: '/onboarding/expert2.avif',
    initials: 'ОП',
    details: [],
  },
];

function ExpertsCard() {
  return (
    <div className="mt-6 flex flex-col gap-3">
      {EXPERTS.map((expert) => (
        <ExpertRow key={expert.name} expert={expert} />
      ))}
    </div>
  );
}

function ExpertRow({ expert }: { expert: (typeof EXPERTS)[number] }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <div className="rounded-3xl bg-card p-5 shadow-soft dark:bg-night-card">
      <div className="flex items-center gap-4">
        {photoFailed ? (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-sage font-heading text-xl font-bold text-white">
            {expert.initials}
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={expert.photo}
            alt={expert.name}
            onError={() => setPhotoFailed(true)}
            className="h-16 w-16 flex-shrink-0 rounded-full object-cover"
          />
        )}
        <div>
          <p className="font-heading text-lg font-bold">{expert.name}</p>
          <p className="text-sm text-ink/60 dark:text-night-muted">{expert.role}</p>
        </div>
      </div>
      {expert.details.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2 text-sm leading-relaxed text-ink/80 dark:text-night-ink/80">
          {expert.details.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
