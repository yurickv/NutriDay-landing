'use client';

import { useState } from 'react';
import type { Step } from '@/lib/onboarding/types';
import { calcSummary } from '@/lib/onboarding/summary';
import { QuizCta } from './QuizLayout';

interface Props {
  step: Step;
  answers: Record<string, unknown>;
  /** Батько зберігає email + personalDataConsent і переходить до лоадера. */
  onDone: (email: string) => void;
}

const EMAIL_RE = /\S+@\S+\.\S+/;

export function ProfileSummaryScreen({ step, answers, onDone }: Props) {
  const s = calcSummary(answers);
  const [email, setEmail] = useState(
    typeof answers.email === 'string' ? answers.email : ''
  );
  const [consent, setConsent] = useState(answers.personalDataConsent === true);
  const canSubmit = EMAIL_RE.test(email) && consent;

  return (
    <div className="flex flex-1 flex-col">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="ІМТ" value={String(s.bmi)} />
        <StatCard label="Норма на день" value={`${s.goalCalories} ккал`} accent />
        <div className="col-span-2 rounded-2xl bg-card px-4 py-3.5 shadow-soft dark:bg-night-card">
          <p className="text-sm text-ink/60 dark:text-night-muted">Орієнтовний БЖВ</p>
          <p className="mt-1 font-heading font-bold">
            {s.proteinG} г білка · {s.fatG} г жирів · {s.carbsG} г вуглеводів
          </p>
        </div>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink/60 dark:text-night-muted">
        Розрахунок орієнтовний і не є медичною рекомендацією. За наявності
        хронічних захворювань порадься з лікарем.
      </p>

      <div className="mt-6">
        <label
          htmlFor="quiz-email"
          className="mb-2 block text-[15px] font-semibold"
        >
          Залиш пошту, щоб ми зберегли твої дані і склали меню.
        </label>
        <input
          id="quiz-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="ph-no-capture w-full rounded-2xl border-2 border-transparent bg-card px-4 py-3.5 shadow-soft outline-none transition-colors focus:border-sage dark:bg-night-card"
        />
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-ink/80 dark:text-night-ink/80">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-sage"
          />
          <span>{step.consent?.text ?? 'Я надаю згоду на обробку моїх персональних даних'}</span>
        </label>
      </div>

      <div className="mt-auto pb-2 pt-8">
        <QuizCta disabled={!canSubmit} onClick={() => onDone(email.trim())}>
          Скласти моє меню
        </QuizCta>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-card px-4 py-3.5 shadow-soft dark:bg-night-card">
      <p className="text-sm text-ink/60 dark:text-night-muted">{label}</p>
      <p
        className={`mt-1 font-heading text-2xl font-bold ${
          accent ? 'text-terracotta' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
