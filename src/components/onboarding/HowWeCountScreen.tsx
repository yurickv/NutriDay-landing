'use client';

import { calcSummary } from '@/lib/onboarding/summary';
import { QuizCta } from './QuizLayout';

interface Props {
  answers: Record<string, unknown>;
  onNext: () => void;
}

// C6: формула Mifflin-St Jeor і три числа BMR → TDEE → норма.
export function HowWeCountScreen({ answers, onNext }: Props) {
  const s = calcSummary(answers);
  return (
    <div className="flex flex-1 flex-col">
      <p className="text-[17px] leading-relaxed text-ink/80 dark:text-night-ink/80">
        Використовуємо формулу Міффліна-Сан Жеора — стандарт, яким користуються
        дієтологи. Без магії, лише арифметика:
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <StatRow
          label="Базовий обмін (BMR)"
          note="Скільки тіло витрачає у спокої"
          value={`${s.bmr} ккал`}
        />
        <StatRow
          label="З урахуванням активності (TDEE)"
          note="BMR × твій рівень активності"
          value={`${s.tdee} ккал`}
        />
        <StatRow
          label="Твоя добова норма"
          note="TDEE з корекцією під твою ціль"
          value={`${s.goalCalories} ккал`}
          accent
        />
      </div>
      <div className="mt-auto pb-2 pt-8">
        <QuizCta onClick={onNext}>Продовжити</QuizCta>
      </div>
    </div>
  );
}

function StatRow({
  label,
  note,
  value,
  accent,
}: {
  label: string;
  note: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3.5 shadow-soft dark:bg-night-card">
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-ink/60 dark:text-night-muted">{note}</p>
      </div>
      <p
        className={`ml-3 font-heading text-xl font-bold ${
          accent ? 'text-terracotta' : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}
