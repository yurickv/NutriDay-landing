'use client';

import { useState } from 'react';
import type { Step } from '@/lib/onboarding/types';
import { OptionIcon } from './OptionIcon';

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

  const options = step.options ?? [];

  // Опції з фото (крок gender) — картки поруч у 2 колонки.
  if (options.some((o) => o.image)) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => pick(o.value)}
            className={`overflow-hidden rounded-2xl border-2 bg-card text-center shadow-soft transition-colors dark:bg-night-card ${
              selected === o.value ? 'border-sage' : 'border-transparent'
            }`}
          >
            {o.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={o.image}
                alt={o.label}
                className="aspect-[3/4] w-full object-cover"
              />
            )}
            <span className="block py-3 font-semibold">{o.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => pick(o.value)}
          className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3.5 text-left shadow-soft transition-colors dark:bg-night-card ${
            selected === o.value ? 'border-sage' : 'border-transparent'
          }`}
        >
          {o.icon && <OptionIcon name={o.icon} active={selected === o.value} />}
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{o.label}</span>
            {o.description && (
              <span className="mt-0.5 block text-sm text-ink/60 dark:text-night-muted">
                {o.description}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
