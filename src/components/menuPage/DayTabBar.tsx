'use client';

import { useEffect, useRef } from 'react';
import { MenuDay } from '@/types/weeklyMenu';

interface DayTabBarProps {
  days: MenuDay[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

function formatShort(dayLabel: string): string {
  const map: Record<string, string> = {
    'Понеділок': 'Пн',
    'Вівторок': 'Вт',
    'Середа': 'Ср',
    'Четвер': 'Чт',
    "П'ятниця": 'Пт',
    'Субота': 'Сб',
    'Неділя': 'Нд',
  };
  return map[dayLabel] ?? dayLabel.slice(0, 2);
}

function getDayNumber(date: Date | string): number {
  return new Date(date).getDate();
}

export function DayTabBar({ days, activeIndex, onSelect }: DayTabBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;

  // Auto-scroll active tab into view
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeEl = container.children[activeIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeIndex]);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto scroll-smooth px-4 py-3 bg-card dark:bg-night-card border-b border-ink/10 dark:border-night-ink/10 scrollbar-none"
      style={{ scrollbarWidth: 'none' }}
    >
      {days.map((day, i) => {
        const dayDate = new Date(day.date);
        const dayStr = `${dayDate.getFullYear()}-${dayDate.getMonth()}-${dayDate.getDate()}`;
        const isToday = dayStr === todayStr;
        const isActive = i === activeIndex;
        const isCompleted = day.isCompleted;

        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-2xl min-w-[52px] transition-all ${
              isActive
                ? 'bg-sage text-card shadow-soft'
                : isCompleted
                ? 'bg-sage-light/60 dark:bg-sage/25 text-sage-dark dark:text-sage-light'
                : 'bg-cream dark:bg-night text-ink/60 dark:text-night-muted hover:bg-sage-light/40 dark:hover:bg-sage/20'
            } ${isToday && !isActive ? 'ring-2 ring-sage dark:ring-sage-light' : ''}`}
            aria-label={`${day.dayLabel}${isToday ? ', сьогодні' : ''}${isCompleted ? ', виконано' : ''}`}
            aria-pressed={isActive}
          >
            <span className="text-[10px] font-semibold flex items-center gap-0.5">
              {isCompleted && (
                <span className={isActive ? 'text-card' : 'text-sage-dark dark:text-sage-light'}>✓</span>
              )}
              {formatShort(day.dayLabel)}
            </span>
            <span className="text-base font-bold leading-none mt-0.5">{getDayNumber(day.date)}</span>
          </button>
        );
      })}
    </div>
  );
}
