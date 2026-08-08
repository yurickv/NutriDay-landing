'use client';

import { useState } from 'react';
import type { Step } from '@/lib/onboarding/types';

interface Props {
  step: Step;
  value?: string;
  onAnswer: (value: string) => void;
}

export function QuestionSingle({ step, value, onAnswer }: Props) {
  const [selected, setSelected] = useState(value ?? '');

  const pick = (v: string) => {
    setSelected(v);
    // Коротка пауза для візуального фідбеку перед авто-переходом.
    setTimeout(() => onAnswer(v), 150);
  };

  return (
    <div className="flex flex-col gap-3">
      {(step.options ?? []).map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => pick(o.value)}
          className={`w-full rounded-2xl border-2 bg-card px-4 py-3.5 text-left shadow-soft transition-colors dark:bg-night-card ${
            selected === o.value ? 'border-sage' : 'border-transparent'
          }`}
        >
          <span className="block font-semibold">{o.label}</span>
          {o.description && (
            <span className="mt-0.5 block text-sm text-ink/60 dark:text-night-muted">
              {o.description}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
