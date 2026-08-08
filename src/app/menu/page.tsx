'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WeeklyMenu } from '@/types/weeklyMenu';
import { UserProfile } from '@/types/userProfile';
import { WeeklyMenuView } from '@/components/menuPage/WeeklyMenuView';
import { GenerateMenuLoader } from '@/components/menuPage/GenerateMenuLoader';
import { StreakBanner } from '@/components/menuPage/StreakBanner';
import { WeightProgressCard } from '@/components/menuPage/WeightProgressCard';
import { DailyTipCard } from '@/components/menuPage/DailyTipCard';
import { useStreak } from '@/hooks/useStreak';
import { RefreshCw, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/common/ThemeToggle';

type AppState = 'loading' | 'no-menu' | 'has-menu' | 'generating' | 'error';

export default function MenuPage() {
  const [state, setState] = useState<AppState>('loading');
  const [menu, setMenu] = useState<WeeklyMenu | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationsLeft, setGenerationsLeft] = useState<number | null>(null);
  const [profileMissing, setProfileMissing] = useState(false);
  const [catchingUp, setCatchingUp] = useState(false);
  const catchingUpRef = useRef(false);

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
      setError('Щось пішло не так. Спробуймо ще раз?');
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

  // Доганяємо решту тижня частинами по ≤3 дні, поки pendingDayIndices не спорожніє.
  // Спрацьовує і після генерації, і при перезавантаженні сторінки з незавершеним меню.
  useEffect(() => {
    if (state !== 'has-menu' || !menu?.pendingDayIndices?.length) return;
    if (catchingUpRef.current) return;
    catchingUpRef.current = true;
    setCatchingUp(true);

    let cancelled = false;

    const run = async (retriesLeft: number) => {
      try {
        const res = await fetch('/api/menu/generate-rest', { method: 'POST' });
        if (!res.ok) throw new Error('generate-rest failed');
        if (cancelled) return;
        await fetchMenu();
      } catch {
        if (cancelled) return;
        if (retriesLeft > 0) {
          await new Promise((r) => setTimeout(r, 3000));
          if (!cancelled) await run(retriesLeft - 1);
          return;
        }
      } finally {
        if (!cancelled) {
          catchingUpRef.current = false;
          setCatchingUp(false);
        }
      }
    };

    void run(2);

    return () => { cancelled = true; };
  }, [state, menu?.pendingDayIndices, fetchMenu]);

  const handleGenerate = async () => {
    if (profileMissing) {
      setError('Спершу заповни профіль — і зробимо меню під тебе.');
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
      setError("Немає з'єднання. Перевір інтернет і спробуй ще раз.");
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
          <p className="text-sm text-ink/60 dark:text-night-muted">Завантажуємо…</p>
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
        <p className="text-center text-ink/60 dark:text-night-muted">{error}</p>
        <button
          onClick={() => { setState('loading'); void fetchMenu(); }}
          className="flex items-center gap-2 bg-terracotta hover:bg-terracotta-dark text-card font-semibold rounded-2xl shadow-soft active:scale-95 transition-all px-5 py-3 text-sm"
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
          <h1 className="font-heading font-semibold text-xl text-ink dark:text-night-ink">
            Ваше персональне меню
          </h1>
          <p className="text-sm text-ink/60 dark:text-night-muted max-w-xs">
            AI-дієтолог складе 7-денний план харчування спеціально для вас — з рецептами, калоріями та списком покупок.
          </p>
        </div>

        {profileMissing ? (
          <div className="bg-terracotta-light/20 dark:bg-terracotta/15 border border-terracotta-light dark:border-terracotta/40 rounded-2xl p-4 max-w-xs w-full text-center">
            <p className="text-sm font-semibold text-terracotta-dark dark:text-terracotta-light mb-1">Профіль не заповнено</p>
            <p className="text-xs text-terracotta-dark dark:text-terracotta-light mb-3">
              Щоб згенерувати меню, спочатку вкажіть свої дані (стать, вік, вагу, зріст)
            </p>
            <a
              href="/profile"
              className="inline-block bg-terracotta hover:bg-terracotta-dark text-card text-sm font-semibold rounded-2xl shadow-soft active:scale-95 transition-all px-5 py-2"
            >
              Заповнити профіль
            </a>
          </div>
        ) : (
          <>
            {error && (
              <div className="bg-danger/10 border border-danger/30 rounded-2xl p-3 max-w-xs w-full">
                <p className="text-sm text-danger dark:text-danger-dark text-center">{error}</p>
              </div>
            )}

            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 bg-terracotta hover:bg-terracotta-dark text-card font-semibold rounded-2xl shadow-soft active:scale-95 transition-all px-8 py-4 text-base"
            >
              <Sparkles size={20} />
              Згенерувати меню
            </button>
          </>
        )}

        {generationsLeft !== null && (
          <p className="text-xs text-ink/60 dark:text-night-muted text-center">
            Залишилось генерацій цього тижня: {generationsLeft}
          </p>
        )}

        <div className="grid grid-cols-3 gap-3 max-w-xs w-full text-center mt-2">
          {[
            { emoji: '🤖', text: 'AI-рецепти' },
            { emoji: '📊', text: 'Ккал і БЖВ' },
            { emoji: '🛒', text: 'Список покупок' },
          ].map(({ emoji, text }) => (
            <div key={text} className="bg-card dark:bg-night-card shadow-soft rounded-2xl p-3">
              <div className="text-2xl mb-1">{emoji}</div>
              <p className="text-xs text-ink/60 dark:text-night-muted font-semibold">{text}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state === 'has-menu' && menu) {
    return (
      <>
        <div className="flex items-center justify-between px-4 py-3 bg-card dark:bg-night-card border-b border-ink/10 dark:border-night-ink/10">
          <div>
            <h1 className="font-heading font-semibold text-lg text-ink dark:text-night-ink">
              Тижневе меню
            </h1>
            <p className="text-xs text-ink/60 dark:text-night-muted">
              {profile?.goalCalories ? `Ціль: ${profile.goalCalories} ккал/день` : 'Персоналізоване харчування'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={handleGenerate}
              className="flex items-center gap-1.5 text-xs text-ink/60 dark:text-night-muted hover:text-terracotta dark:hover:text-terracotta-light bg-cream dark:bg-night px-3 py-2 rounded-xl transition-colors"
              title="Перегенерувати меню"
            >
              <RefreshCw size={13} />
              Нове меню
            </button>
          </div>
        </div>

        {/* Engagement widgets */}
        <DailyTipCard />

        {catchingUp && (
          <div className="mx-4 mt-3 flex items-center gap-2 bg-terracotta-light/20 dark:bg-terracotta/15 border border-terracotta-light dark:border-terracotta/40 rounded-2xl px-4 py-2.5">
            <span className="text-lg animate-spin">🌀</span>
            <p className="text-xs text-terracotta-dark dark:text-terracotta-light font-medium">
              Доганяємо решту тижня…
            </p>
          </div>
        )}

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
