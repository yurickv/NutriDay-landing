'use client';

import { useState } from 'react';
import type { Step } from '@/lib/onboarding/types';
import { QuizCta } from './QuizLayout';

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
      {step.key === 'expert' && <ExpertCard />}
      <div className="mt-auto pb-2 pt-8">
        <QuizCta onClick={onNext}>Продовжити</QuizCta>
      </div>
    </div>
  );
}

// Скріни з застосунку (B5, B9) можуть ще не існувати — тоді м'який placeholder.
function QuizImage({ image }: { image: { src: string; alt: string } }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="mt-6 flex h-48 items-center justify-center rounded-3xl bg-sage-light/40 text-5xl dark:bg-night-card">
        📱
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

// B13. Фото — public/onboarding/expert.avif; якщо файлу немає — ініціали.
function ExpertCard() {
  const [photoFailed, setPhotoFailed] = useState(false);
  return (
    <div className="mt-6 rounded-3xl bg-card p-5 shadow-soft dark:bg-night-card">
      <div className="flex items-center gap-4">
        {photoFailed ? (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-sage font-heading text-xl font-bold text-white">
            ЮТ
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/onboarding/expert.avif"
            alt="Юрій Теслюк"
            onError={() => setPhotoFailed(true)}
            className="h-16 w-16 flex-shrink-0 rounded-full object-cover"
          />
        )}
        <div>
          <p className="font-heading text-lg font-bold">Юрій Теслюк</p>
          <p className="text-sm text-ink/60 dark:text-night-muted">15 років у фітнесі</p>
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-2 text-sm leading-relaxed text-ink/80 dark:text-night-ink/80">
        <li>· 10 років персональним тренером у «Адреналін», Тернопіль</li>
        <li>· Сертифікат курсу «Здорове харчування», Prometheus</li>
      </ul>
    </div>
  );
}
