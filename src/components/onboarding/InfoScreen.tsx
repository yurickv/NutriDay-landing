'use client';

import { useState } from 'react';
import { Smartphone } from 'lucide-react';
import type { Step } from '@/lib/onboarding/types';
import { CtaBar, QuizCta } from './QuizLayout';

interface Props {
  step: Step;
  /** Текст, уже резолвлений через resolveInfoContent (variants + bodyShort). */
  body?: string;
  onNext: () => void;
}

export function InfoScreen({ step, body, onNext }: Props) {
  return (
    <div className="flex flex-1 flex-col">
      {body && (
        <p className="text-[17px] leading-relaxed text-ink/80 dark:text-night-ink/80">{body}</p>
      )}
      {step.image && <QuizImage image={step.image} />}
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
      <div className="mt-6 flex h-48 items-center justify-center rounded-3xl bg-sage-light/40 dark:bg-night-card">
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
      className="mt-6 w-full rounded-3xl shadow-soft"
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
