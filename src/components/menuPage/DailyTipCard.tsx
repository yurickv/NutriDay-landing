'use client';

import { useDailyTip } from '@/hooks/useDailyTip';
import { Tip } from '@/types/engagement';

const CATEGORY_ICON: Record<Tip['category'], string> = {
  nutrition: '🥦',
  hydration: '💧',
  motivation: '✨',
  cooking: '🍳',
  lifestyle: '🌿',
};

const CATEGORY_LABEL: Record<Tip['category'], string> = {
  nutrition: 'Харчування',
  hydration: 'Гідратація',
  motivation: 'Мотивація',
  cooking: 'Готування',
  lifestyle: 'Спосіб життя',
};

interface DailyTipCardProps {
  context?: Tip['category'];
}

export function DailyTipCard({ context }: DailyTipCardProps) {
  const { tip, loading } = useDailyTip(context);

  if (loading) {
    return (
      <div className="mx-4 my-3 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />
    );
  }

  if (!tip) return null;

  return (
    <div className="mx-4 my-3 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/30 border border-green-100 dark:border-green-900/40 p-4">
      <div className="flex gap-3">
        <span className="text-2xl flex-shrink-0 leading-none mt-0.5">
          {CATEGORY_ICON[tip.category]}
        </span>
        <div>
          <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1">
            {CATEGORY_LABEL[tip.category]} · Лайфхак дня
          </p>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-snug">
            {tip.text}
          </p>
        </div>
      </div>
    </div>
  );
}
