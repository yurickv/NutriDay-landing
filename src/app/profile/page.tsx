'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { WeightLogSection } from '@/components/profilePage/WeightLogSection';
import { FoodPreferencesEditor } from '@/components/profilePage/FoodPreferencesEditor';
import { BiometricsGoalEditor } from '@/components/profilePage/BiometricsGoalEditor';
import { useStreak } from '@/hooks/useStreak';
import { UserProfile } from '@/types/userProfile';
import NotificationSettings from '@/components/profilePage/NotificationSettings';
import InstallAppSettings from '@/components/profilePage/InstallAppSettings';
import SilpoConnectSettings from '@/components/profilePage/SilpoConnectSettings';
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
      <div className="px-4 py-3 bg-card dark:bg-night-card border-b border-ink/10 dark:border-night-ink/10 flex items-center justify-between gap-2">
        <h1 className="font-heading font-semibold text-lg text-ink dark:text-night-ink">Профіль</h1>
        <ThemeToggle />
      </div>

      {/* Profile summary */}
      {!loadingProfile && profile && (
        <div className="mx-4 mt-4 rounded-2xl bg-card dark:bg-night-card shadow-soft p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-sage flex items-center justify-center shrink-0">
              <span className="text-lg font-heading font-bold text-card">
                {profile.userEmail.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink dark:text-night-ink truncate">
                {profile.userEmail}
              </p>
              <p className="text-xs text-ink/60 dark:text-night-muted mt-0.5">
                {profile.mainGoal && GOAL_LABELS[profile.mainGoal]
                  ? `${GOAL_LABELS[profile.mainGoal]} · `
                  : ''}
                <span className="font-semibold text-sage-dark dark:text-sage-light">{profile.goalCalories} ккал/день</span>
                {profile.weightKg ? ` · ${profile.weightKg} кг` : ''}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-heading font-bold text-terracotta">
                {streak?.currentStreak ?? 0}
              </p>
              <p className="text-xs text-ink/50 dark:text-night-muted">🔥 стрік</p>
            </div>
          </div>
        </div>
      )}

      {loadingProfile && (
        <div className="mx-4 mt-4 h-20 bg-ink/10 dark:bg-night-ink/10 rounded-2xl animate-pulse" />
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
          <div className="rounded-2xl bg-card dark:bg-night-card shadow-soft p-4">
            <h2 className="font-heading font-semibold text-base text-ink dark:text-night-ink mb-3 flex items-center gap-2">
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
                    className="bg-sage-light/40 dark:bg-sage/20 border border-sage-light dark:border-sage/40 rounded-2xl px-3 py-2 text-xs font-semibold text-sage-dark dark:text-sage-light"
                  >
                    {labels[badge.id] ?? badge.id}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Застосунок (PWA) */}
      <section className="mx-4 mb-4">
        <p className="text-xs font-semibold text-ink/50 dark:text-night-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span>📱</span> Застосунок
        </p>
        <InstallAppSettings />
      </section>

      {/* Сільпо (рендериться лише коли інтеграцію увімкнено env-ключами) */}
      <SilpoConnectSettings />

      {/* В розробці */}
      <section className="mx-4 mb-4">
        <p className="text-xs font-semibold text-ink/50 dark:text-night-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <span>🚧</span> Незабаром
        </p>
        <div className="rounded-2xl bg-card dark:bg-night-card shadow-soft overflow-hidden divide-y divide-ink/10 dark:divide-night-ink/10">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-medium bg-terracotta-light/20 dark:bg-terracotta/15 border border-terracotta-light dark:border-terracotta/40 text-terracotta-dark dark:text-terracotta-light px-2 py-0.5 rounded-full">
                🔔 Push-нагадування · В розробці
              </span>
            </div>
            <NotificationSettings />
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 opacity-60">
            <div className="flex items-center gap-3">
              <span className="text-lg">📊</span>
              <div>
                <p className="text-sm font-medium text-ink dark:text-night-ink">Тижневий звіт</p>
                <p className="text-xs text-ink/60 dark:text-night-muted">Аналіз харчування та прогресу</p>
              </div>
            </div>
            <span className="text-xs font-medium bg-terracotta-light/20 dark:bg-terracotta/15 border border-terracotta-light dark:border-terracotta/40 text-terracotta-dark dark:text-terracotta-light px-2 py-0.5 rounded-full whitespace-nowrap">
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
          className="w-full rounded-2xl border border-ink/10 dark:border-night-ink/10 bg-card dark:bg-night-card px-4 py-3 text-sm font-semibold text-ink dark:text-night-ink active:scale-95 transition-all disabled:opacity-60"
        >
          Вийти з акаунту
        </button>
        {!confirmLogoutAll ? (
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => setConfirmLogoutAll(true)}
            className="w-full rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger dark:text-danger-dark active:scale-95 transition-all disabled:opacity-60"
          >
            Вийти на всіх пристроях
          </button>
        ) : (
          <div className="rounded-2xl border border-danger/30 bg-danger/10 px-4 py-3">
            <p className="text-sm text-danger dark:text-danger-dark font-medium text-center mb-3">
              Вийти з усіх пристроїв?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmLogoutAll(false)}
                className="flex-1 py-2 rounded-xl border border-ink/10 dark:border-night-ink/10 bg-card dark:bg-night-card text-sm font-medium text-ink/60 dark:text-night-muted active:scale-95 transition-all"
              >
                Скасувати
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => void handleLogout(true)}
                className="flex-1 py-2 rounded-xl bg-danger text-card text-sm font-semibold active:scale-95 transition-all disabled:opacity-60"
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
