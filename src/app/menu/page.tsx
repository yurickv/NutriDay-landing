'use client';

import { useState, useEffect, useCallback } from 'react';
import { WeeklyMenu } from '@/types/weeklyMenu';
import { UserProfile } from '@/types/userProfile';
import { WeeklyMenuView } from '@/components/menuPage/WeeklyMenuView';
import { GenerateMenuLoader } from '@/components/menuPage/GenerateMenuLoader';
import { StreakBanner } from '@/components/menuPage/StreakBanner';
import { WeightProgressCard } from '@/components/menuPage/WeightProgressCard';
import { DailyTipCard } from '@/components/menuPage/DailyTipCard';
import { useStreak } from '@/hooks/useStreak';
import { RefreshCw, Sparkles } from 'lucide-react';

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('nd_theme');
    const isDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('nd_theme', next ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      className="text-xl leading-none p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      aria-label="Змінити тему"
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}

type AppState = 'loading' | 'no-menu' | 'has-menu' | 'generating' | 'error';

export default function MenuPage() {
  const [state, setState] = useState<AppState>('loading');
  const [menu, setMenu] = useState<WeeklyMenu | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationsLeft, setGenerationsLeft] = useState<number | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);

  const { streak } = useStreak();

  const fetchMenu = useCallback(async () => {
    try {
      const res = await fetch('/api/menu/weekly');
      if (!res.ok) throw new Error('Failed to load menu');
      const data = await res.json() as { menu: WeeklyMenu | null };
      setMenu(data.menu);
      setState(data.menu ? 'has-menu' : 'no-menu');
    } catch {
      setState('error');
      setError('Не вдалося завантажити меню. Спробуйте пізніше.');
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json() as UserProfile;
        setProfile(data);
        setProfileMissing(false);
      } else if (res.status === 404) {
        setProfileMissing(true);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void Promise.all([fetchMenu(), fetchProfile()]);
  }, [fetchMenu, fetchProfile]);

  const handleGenerate = async () => {
    if (profileMissing) {
      setError('Будь ласка, заповніть профіль перед генерацією меню.');
      return;
    }
    setState('generating');
    setError(null);

    try {
      const res = await fetch('/api/menu/generate', { method: 'POST' });
      const data = await res.json() as { error?: string; message?: string; generationsLeft?: number };

      if (!res.ok) {
        setError(data.message ?? data.error ?? 'Помилка генерації');
        setState(menu ? 'has-menu' : 'no-menu');
        return;
      }

      if (data.generationsLeft !== undefined) {
        setGenerationsLeft(data.generationsLeft);
      }
      await fetchMenu();
    } catch {
      setError('Сталася помилка. Перевірте підключення до інтернету.');
      setState(menu ? 'has-menu' : 'no-menu');
    }
  };

  const handleRefreshMenu = useCallback(async () => {
    const res = await fetch('/api/menu/weekly');
    if (res.ok) {
      const data = await res.json() as { menu: WeeklyMenu | null };
      setMenu(data.menu);
    }
  }, []);

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="text-4xl animate-spin inline-block">🌀</div>
          <p className="text-sm text-neutral-500">Завантажуємо…</p>
        </div>
      </div>
    );
  }

  if (state === 'generating') {
    return <GenerateMenuLoader />;
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-4">
        <span className="text-5xl">😔</span>
        <p className="text-center text-neutral-600 dark:text-neutral-400">{error}</p>
        <button
          onClick={() => { setState('loading'); void fetchMenu(); }}
          className="flex items-center gap-2 bg-main text-white px-5 py-3 rounded-2xl font-semibold text-sm"
        >
          <RefreshCw size={16} />
          Спробувати знову
        </button>
      </div>
    );
  }

  if (state === 'no-menu') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 gap-5">
        <div className="text-center space-y-2">
          <div className="text-6xl mb-4">🥗</div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Ваше персональне меню
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs">
            AI-дієтолог складе 7-денний план харчування спеціально для вас — з рецептами, калоріями та списком покупок.
          </p>
        </div>

        {profileMissing ? (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-4 max-w-xs w-full text-center">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 mb-1">Профіль не заповнено</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mb-3">
              Щоб згенерувати меню, спочатку вкажіть свої дані (стать, вік, вагу, зріст)
            </p>
            <a
              href="/profile"
              className="inline-block bg-yellow-400 hover:bg-yellow-500 text-white text-sm font-bold px-5 py-2 rounded-xl transition-colors"
            >
              Заповнити профіль
            </a>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-3 max-w-xs w-full">
                <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 bg-main text-white px-8 py-4 rounded-2xl font-bold text-base shadow-lg active:scale-95 transition-transform"
            >
              <Sparkles size={20} />
              Згенерувати меню
            </button>
          </>
        )}

        {generationsLeft !== null && (
          <p className="text-xs text-neutral-400 text-center">
            Залишилось генерацій цього тижня: {generationsLeft}
          </p>
        )}

        <div className="grid grid-cols-3 gap-3 max-w-xs w-full text-center mt-2">
          {[
            { emoji: '🤖', text: 'AI-рецепти' },
            { emoji: '📊', text: 'Ккал і БЖВ' },
            { emoji: '🛒', text: 'Список покупок' },
          ].map(({ emoji, text }) => (
            <div key={text} className="bg-neutral-100 dark:bg-neutral-800 rounded-2xl p-3">
              <div className="text-2xl mb-1">{emoji}</div>
              <p className="text-xs text-neutral-500 font-semibold">{text}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state === 'has-menu' && menu) {
    return (
      <>
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800">
          <div>
            <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Тижневе меню
            </h1>
            <p className="text-xs text-neutral-400">
              {profile?.goalCalories ? `Ціль: ${profile.goalCalories} ккал/день` : 'Персоналізоване харчування'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-main bg-neutral-100 dark:bg-neutral-800 px-3 py-2 rounded-xl transition-colors"
              title="Перегенерувати меню"
            >
              <RefreshCw size={13} />
              Нове меню
            </button>
          </div>
        </div>

        {/* Engagement widgets */}
        <DailyTipCard />

        <WeeklyMenuView
          menu={menu}
          goalCalories={profile?.goalCalories ?? 1500}
          onMenuUpdate={handleRefreshMenu}
        />

        {/* Streak + weight moved to the very bottom of the screen */}
        {streak && streak.currentStreak > 0 && <StreakBanner streak={streak} />}
        <WeightProgressCard />
      </>
    );
  }

  return null;
}
