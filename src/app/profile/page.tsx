'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { WeightLogSection } from '@/components/profilePage/WeightLogSection';
import { FoodPreferencesEditor } from '@/components/profilePage/FoodPreferencesEditor';
import { BiometricsGoalEditor } from '@/components/profilePage/BiometricsGoalEditor';
import { useStreak } from '@/hooks/useStreak';
import { UserProfile } from '@/types/userProfile';
import NotificationSettings from '@/components/profilePage/NotificationSettings';
import { ThemeToggle } from '@/components/common/ThemeToggle';

const GOAL_LABELS: Record<string, string> = {
  lose_weight: 'Схуднути',
  maintain_weight: 'Підтримувати вагу',
  gain_weight: 'Набрати вагу',
  build_muscle: "Наростити м'язи",
  something_else: 'Інше',
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const { streak } = useStreak();

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) setProfile(await res.json() as UserProfile);
    } catch {
      // non-critical
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  useEffect(() => { void fetchProfile(); }, [fetchProfile]);

  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);

  const handleLogout = async (allDevices: boolean) => {
    setLoggingOut(true);
    try {
      await fetch(allDevices ? '/api/auth/logout-all' : '/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore — navigate away regardless
    } finally {
      window.location.href = '/auth/login';
    }
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
        <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Профіль</h1>
        <ThemeToggle />
      </div>

      {/* Profile summary */}
      {!loadingProfile && profile && (
        <div className="mx-4 mt-4 rounded-2xl bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/40 dark:to-yellow-950/30 border border-orange-100 dark:border-orange-900/40 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),_0_6px_24px_rgba(120,120,120,0.25)] p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-white">
                {profile.userEmail.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-neutral-800 dark:text-neutral-100 truncate">
                {profile.userEmail}
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">
                {profile.mainGoal && GOAL_LABELS[profile.mainGoal]
                  ? `${GOAL_LABELS[profile.mainGoal]} · `
                  : ''}
                <span className="font-semibold text-main">{profile.goalCalories} ккал/день</span>
                {profile.weightKg ? ` · ${profile.weightKg} кг` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-bold text-main">
                {streak?.currentStreak ?? 0}
              </p>
              <p className="text-xs text-neutral-400">🔥 стрік</p>
            </div>
          </div>
        </div>
      )}

      {loadingProfile && (
        <div className="mx-4 mt-4 h-20 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />
      )}

      {/* Biometrics + goal */}
      {!loadingProfile && (
        <BiometricsGoalEditor profile={profile} onSaved={fetchProfile} />
      )}

      {/* Food preferences */}
      {!loadingProfile && profile && (
        <FoodPreferencesEditor
          profile={profile}
          onSaved={(fields) => setProfile((prev) => prev ? { ...prev, ...fields } : prev)}
        />
      )}

      {/* Weight tracker */}
      <WeightLogSection />

      {/* Streak badges */}
      {streak && streak.badges.length > 0 && (
        <section className="mx-4 mb-4">
          <div className="rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),_0_6px_24px_rgba(120,120,120,0.25)] p-4">
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
              <span>🏅</span> Мої бейджі
            </h2>
            <div className="flex flex-wrap gap-2">
              {streak.badges.map((badge) => {
                const labels: Record<string, string> = {
                  streak_3: '3 дні 🌱', streak_7: '7 днів 🔥',
                  streak_14: '2 тижні ⚡', streak_30: 'Місяць 🌟',
                  streak_60: '2 місяці 💎', streak_100: '100 днів 🏆',
                };
                return (
                  <div
                    key={badge.id}
                    className="bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-2xl px-3 py-2 text-xs font-semibold text-orange-700 dark:text-orange-300"
                  >
                    {labels[badge.id] ?? badge.id}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* В розробці */}
      <section className="mx-4 mb-4">
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span>🚧</span> Незабаром
        </p>
        <div className="rounded-2xl border border-neutral-100 dark:border-neutral-800 overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),_0_6px_24px_rgba(120,120,120,0.25)]">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full">
                🔔 Push-нагадування · В розробці
              </span>
            </div>
            <NotificationSettings />
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 opacity-60">
            <div className="flex items-center gap-3">
              <span className="text-lg">📊</span>
              <div>
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Тижневий звіт</p>
                <p className="text-xs text-neutral-400">Аналіз харчування та прогресу</p>
              </div>
            </div>
            <span className="text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full whitespace-nowrap">
              В розробці
            </span>
          </div>
        </div>
      </section>

      {/* Logout */}
      <section className="mx-4 mb-8 space-y-2">
        <button
          type="button"
          disabled={loggingOut}
          onClick={() => void handleLogout(false)}
          className="w-full rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300 disabled:opacity-60"
        >
          Вийти з акаунту
        </button>
        {!confirmLogoutAll ? (
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => setConfirmLogoutAll(true)}
            className="w-full rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 px-4 py-3 text-sm font-semibold text-red-500 dark:text-red-400 disabled:opacity-60"
          >
            Вийти на всіх пристроях
          </button>
        ) : (
          <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-3">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium text-center mb-3">
              Вийти з усіх пристроїв?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmLogoutAll(false)}
                className="flex-1 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm font-medium text-neutral-600 dark:text-neutral-400"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => void handleLogout(true)}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-60"
              >
                Підтвердити
              </button>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
