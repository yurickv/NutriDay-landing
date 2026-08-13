'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import type { Option, Step } from '@/lib/onboarding/types';
import { CtaBar, QuizCta } from './QuizLayout';
import { OptionIcon } from './OptionIcon';

interface Props {
  step: Step;
  value?: string[];
  onAnswer: (value: string[]) => void;
}

export function QuestionMulti({ step, value, onAnswer }: Props) {
  const [selected, setSelected] = useState<string[]>(value ?? []);
  const options = step.options ?? [];
  const noneValues = options.filter((o) => o.isNone).map((o) => o.value);

  const toggle = (o: Option) => {
    setSelected((prev) => {
      if (prev.includes(o.value)) return prev.filter((v) => v !== o.value);
      // «Нічого з переліченого» знімає інші вибори — і навпаки.
      if (o.isNone) return [o.value];
      return [...prev.filter((v) => !noneValues.includes(v)), o.value];
    });
  };

  return (
    <div className="flex flex-1 flex-col">
      <p className="mb-3 text-sm text-ink/60 dark:text-night-muted">
        Обери все, що підходить
      </p>
      <div className="flex flex-col gap-3">
        {options.map((o) => {
          const active = selected.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o)}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3.5 text-left shadow-soft transition-colors dark:bg-night-card ${
                active ? 'border-sage' : 'border-transparent'
              }`}
            >
              {o.icon && <OptionIcon name={o.icon} active={active} />}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{o.label}</span>
                {o.description && (
                  <span className="mt-0.5 block text-sm text-ink/60 dark:text-night-muted">
                    {o.description}
                  </span>
                )}
              </span>
              <span
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${
                  active
                    ? 'border-sage bg-sage text-white'
                    : 'border-ink/20 dark:border-night-muted/40'
                }`}
              >
                {active && <Check className="h-4 w-4" />}
              </span>
            </button>
          );
        })}
      </div>
      <CtaBar sticky={step.stickyCta}>
        <QuizCta disabled={selected.length === 0} onClick={() => onAnswer(selected)}>
          Далі
        </QuizCta>
      </CtaBar>
    </div>
  );
}
