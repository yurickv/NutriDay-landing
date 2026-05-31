'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { WeightLogSection } from '@/components/profilePage/WeightLogSection';
import { FoodPreferencesEditor } from '@/components/profilePage/FoodPreferencesEditor';
import { BiometricsGoalEditor } from '@/components/profilePage/BiometricsGoalEditor';
import { useStreak } from '@/hooks/useStreak';
import { UserProfile } from '@/types/userProfile';
import { ChevronRight } from 'lucide-react';
import NotificationSettings from '@/components/profilePage/NotificationSettings';

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
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void handleLogout(false)}
            className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2.5 py-1 text-xs font-semibold text-neutral-700 dark:text-neutral-300 disabled:opacity-60"
          >
            Вийти
          </button>
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void handleLogout(true)}
            className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400 disabled:opacity-60"
          >
            Вийти всюди
          </button>
        </div>
      </div>

      {/* Profile summary */}
      {!loadingProfile && profile && (
        <div className="mx-4 mt-4 rounded-2xl bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-950/40 dark:to-yellow-950/30 border border-orange-100 dark:border-orange-900/40 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-neutral-800 dark:text-neutral-100">
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
            <div className="text-right">
              <p className="text-2xl font-bold text-main">
                {streak?.currentStreak ?? 0}
              </p>
              <p className="text-xs text-neutral-400">🔥 стрік</p>
            </div>
          </div>
        </div>
      )}

      {loadingProfile && (
        <div className="mx-4 mt-4 h-28 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />
      )}

      {/* Biometrics + goal: setup card when no profile, collapsible editor otherwise */}
      {!loadingProfile && (
        <BiometricsGoalEditor profile={profile} onSaved={fetchProfile} />
      )}

      {/* Weight tracker */}
      <WeightLogSection />

      {/* Food preferences */}
      {!loadingProfile && profile && (
        <FoodPreferencesEditor
          profile={profile}
          onSaved={(fields) => setProfile((prev) => prev ? { ...prev, ...fields } : prev)}
        />
      )}

      {/* Streak badges */}
      {streak && streak.badges.length > 0 && (
        <section className="px-4 pb-5">
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
        </section>
      )}

      {/* Notification settings */}
      <section className="px-4 pb-4">
        <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
          <span>🔔</span> Нагадування
        </h2>
        <NotificationSettings />
      </section>

      {/* Coming soon */}
      <section className="px-4 pb-8">
        <div className="rounded-2xl border border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center justify-between px-4 py-3.5 opacity-60">
            <div className="flex items-center gap-3">
              <span className="text-lg">📊</span>
              <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Тижневий звіт</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full">Скоро</span>
              <ChevronRight size={16} className="text-neutral-300" />
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
