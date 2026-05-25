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
      className="flex gap-2 overflow-x-auto scroll-smooth px-4 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 scrollbar-none"
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
                ? 'bg-main text-white shadow-md'
                : isCompleted
                ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
            aria-label={`${day.dayLabel}${isToday ? ', сьогодні' : ''}${isCompleted ? ', виконано' : ''}`}
            aria-pressed={isActive}
          >
            <span className="text-[10px] font-semibold">{formatShort(day.dayLabel)}</span>
            <span className="text-base font-bold leading-none mt-0.5">{getDayNumber(day.date)}</span>
            {isCompleted && !isActive && (
              <span className="text-[9px] mt-0.5">✓</span>
            )}
            {isToday && !isActive && (
              <div className="w-1 h-1 rounded-full bg-main mt-0.5" />
            )}
          </button>
        );
      })}
    </div>
  );
}
