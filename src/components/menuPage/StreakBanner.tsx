'use client';

import { UserStreak } from '@/types/engagement';

const BADGE_LABELS: Record<string, string> = {
  streak_3: '3 дні',
  streak_7: '7 днів',
  streak_14: '2 тижні',
  streak_30: 'Місяць',
  streak_60: '2 місяці',
  streak_100: '100 днів',
};

const BADGE_EMOJIS: Record<string, string> = {
  streak_3: '🌱',
  streak_7: '🔥',
  streak_14: '⚡',
  streak_30: '🌟',
  streak_60: '💎',
  streak_100: '🏆',
};

interface StreakBannerProps {
  streak: UserStreak;
}

export function StreakBanner({ streak }: StreakBannerProps) {
  const { currentStreak, longestStreak, totalDaysCompleted, badges } = streak;

  if (currentStreak === 0 && totalDaysCompleted === 0) return null;

  const latestBadge = badges.length > 0 ? badges[badges.length - 1] : null;

  return (
    <div className="mx-4 my-3 rounded-2xl bg-card dark:bg-night-card shadow-soft p-4">
      {/* Main streak */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl leading-none">🔥</div>
          <div>
            <p className="text-sm font-bold text-ink dark:text-night-ink">
              {currentStreak > 0
                ? `${currentStreak} ${pluralDays(currentStreak)} поспіль`
                : 'Починай сьогодні!'}
            </p>
            <p className="text-xs text-ink/60 dark:text-night-muted">
              Всього виконано: {totalDaysCompleted} {pluralDays(totalDaysCompleted)}
            </p>
          </div>
        </div>

        {longestStreak > 0 && (
          <div className="text-right">
            <p className="text-xs text-ink/60 dark:text-night-muted">Рекорд</p>
            <p className="text-sm font-bold text-terracotta">{longestStreak}д</p>
          </div>
        )}
      </div>

      {/* Latest badge */}
      {latestBadge && (
        <div className="mt-3 pt-3 border-t border-ink/10 dark:border-night-ink/10 flex items-center gap-2">
          <span className="text-xl">
            {BADGE_EMOJIS[latestBadge.id] ?? '🏅'}
          </span>
          <div>
            <p className="text-xs font-semibold text-terracotta-dark dark:text-terracotta-light">
              Бейдж розблоковано!
            </p>
            <p className="text-xs text-ink/60 dark:text-night-muted">
              {BADGE_LABELS[latestBadge.id] ?? latestBadge.id} — ти молодець!
            </p>
          </div>
        </div>
      )}

      {/* Progress to next badge */}
      {currentStreak > 0 && <NextBadgeProgress currentStreak={currentStreak} badges={badges.map((b) => b.id)} />}
    </div>
  );
}

function NextBadgeProgress({ currentStreak, badges }: { currentStreak: number; badges: string[] }) {
  const THRESHOLDS = [3, 7, 14, 30, 60, 100];
  const next = THRESHOLDS.find((t) => !badges.includes(`streak_${t}`) && t > currentStreak);
  if (!next) return null;

  const prev = THRESHOLDS.filter((t) => t < next).at(-1) ?? 0;
  const progress = Math.min(100, Math.round(((currentStreak - prev) / (next - prev)) * 100));

  return (
    <div className="mt-3 space-y-1">
      <div className="flex justify-between text-xs text-ink/60 dark:text-night-muted">
        <span>До {BADGE_EMOJIS[`streak_${next}`]} {BADGE_LABELS[`streak_${next}`]}</span>
        <span>{next - currentStreak} д.</span>
      </div>
      <div className="h-1.5 bg-sage-light/40 dark:bg-night rounded-full overflow-hidden">
        <div
          className="h-full bg-sage rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function pluralDays(n: number): string {
  if (n % 10 === 1 && n % 100 !== 11) return 'день';
  if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) return 'дні';
  return 'днів';
}
