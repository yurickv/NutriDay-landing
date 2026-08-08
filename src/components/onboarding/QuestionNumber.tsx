'use client';

import { useState } from 'react';
import type { Step } from '@/lib/onboarding/types';
import { QuizCta } from './QuizLayout';

interface Props {
  step: Step;
  value?: string;
  onAnswer: (value: string) => void;
}

export function QuestionNumber({ step, value, onAnswer }: Props) {
  const [raw, setRaw] = useState(value ?? '');
  const n = parseFloat(raw);
  const valid =
    raw !== '' &&
    !Number.isNaN(n) &&
    (step.min === undefined || n >= step.min) &&
    (step.max === undefined || n <= step.max);
  const showError = raw !== '' && !valid;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-end gap-3">
        <input
          type="number"
          inputMode="decimal"
          autoFocus
          value={raw}
          min={step.min}
          max={step.max}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && valid) onAnswer(String(n));
          }}
          className="w-40 rounded-2xl border-2 border-transparent bg-card px-4 py-3.5 font-heading text-3xl font-bold shadow-soft outline-none transition-colors focus:border-sage dark:bg-night-card"
        />
        {step.unit && (
          <span className="pb-4 text-lg text-ink/60 dark:text-night-muted">{step.unit}</span>
        )}
      </div>
      {showError && (
        <p className="mt-2 text-sm text-danger dark:text-danger-dark">
          Введи число від {step.min} до {step.max}
        </p>
      )}
      <div className="mt-8 pb-2 pt-4">
        <QuizCta disabled={!valid} onClick={() => onAnswer(String(n))}>
          Далі
        </QuizCta>
      </div>
    </div>
  );
}
