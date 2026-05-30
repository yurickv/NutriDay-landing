'use client';

import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { WeightLogSection } from '@/components/profilePage/WeightLogSection';
import { FoodPreferencesEditor } from '@/components/profilePage/FoodPreferencesEditor';
import { useStreak } from '@/hooks/useStreak';
import { UserProfile } from '@/types/userProfile';
import { ChevronRight } from 'lucide-react';
import NotificationSettings from '@/components/profilePage/NotificationSettings';

const ACTIVITY_OPTIONS = [
  { value: '1.2', label: 'Сидячий (мінімум руху)' },
  { value: '1.375', label: 'Легка активність (1–3 тренування/тиж)' },
  { value: '1.55', label: 'Помірна активність (3–5 тренувань/тиж)' },
  { value: '1.725', label: 'Висока активність (6–7 тренувань/тиж)' },
  { value: '1.9', label: 'Дуже висока активність' },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const { streak } = useStreak();

  // Setup form state
  const [setupForm, setSetupForm] = useState({ sex: 'female', age: '', weight: '', height: '', activity: '1.375' });
  const [setupSaving, setSetupSaving] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

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

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupForm.age || !setupForm.weight || !setupForm.height) {
      setSetupError('Заповніть всі поля');
      return;
    }
    setSetupSaving(true);
    setSetupError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sex: setupForm.sex,
          ageYears: parseInt(setupForm.age, 10),
          weightKg: parseFloat(setupForm.weight),
          heightCm: parseFloat(setupForm.height),
          activityLevel: parseFloat(setupForm.activity),
        }),
      });
      if (!res.ok) throw new Error('Помилка збереження');
      await fetchProfile();
    } catch {
      setSetupError('Не вдалося зберегти. Спробуйте ще раз.');
    } finally {
      setSetupSaving(false);
    }
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="px-4 py-4 border-b border-neutral-100 dark:border-neutral-800">
        <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Профіль</h1>
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
                Ціль: <span className="font-semibold text-main">{profile.goalCalories} ккал/день</span>
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

          {/* Macro summary */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'BMR', value: profile.bmr ? `${profile.bmr} ккал` : '—' },
              { label: 'TDEE', value: profile.tdee ? `${profile.tdee} ккал` : '—' },
              { label: 'Вода', value: profile.waterGoalMl ? `${profile.waterGoalMl} мл` : '2000 мл' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/60 dark:bg-neutral-900/40 rounded-xl py-2 px-1">
                <p className="text-xs text-neutral-400">{label}</p>
                <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {loadingProfile && (
        <div className="mx-4 mt-4 h-28 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />
      )}

      {/* Profile setup form (shown when no profile exists) */}
      {!loadingProfile && !profile && (
        <form onSubmit={handleSetupSubmit} className="mx-4 mt-4 rounded-2xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Налаштуйте профіль</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Вкажіть свої дані для персоналізованого меню</p>
          </div>

          {/* Sex */}
          <div className="flex gap-2">
            {(['female', 'male'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSetupForm((f) => ({ ...f, sex: s }))}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  setupForm.sex === s
                    ? 'bg-main text-white border-main'
                    : 'bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700'
                }`}
              >
                {s === 'female' ? 'Жінка' : 'Чоловік'}
              </button>
            ))}
          </div>

          {/* Age / Weight / Height */}
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'age', label: 'Вік', placeholder: '25', unit: 'р.' },
              { key: 'weight', label: 'Вага', placeholder: '65', unit: 'кг' },
              { key: 'height', label: 'Зріст', placeholder: '170', unit: 'см' },
            ] as const).map(({ key, label, placeholder, unit }) => (
              <div key={key}>
                <label className="text-xs text-neutral-500 mb-1 block">{label}</label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder={placeholder}
                    value={setupForm[key]}
                    onChange={(e) => setSetupForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 pr-7"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-400">{unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Activity */}
          <div>
            <label className="text-xs text-neutral-500 mb-1 block">Рівень активності</label>
            <select
              value={setupForm.activity}
              onChange={(e) => setSetupForm((f) => ({ ...f, activity: e.target.value }))}
              className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            >
              {ACTIVITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {setupError && (
            <p className="text-xs text-red-500 text-center">{setupError}</p>
          )}

          <button
            type="submit"
            disabled={setupSaving}
            className="w-full bg-main text-white py-3 rounded-xl font-bold text-sm disabled:opacity-60"
          >
            {setupSaving ? 'Зберігаємо…' : 'Зберегти профіль'}
          </button>
        </form>
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

      {/* Account / session */}
      <section className="px-4 pb-4">
        <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 mb-3 flex items-center gap-2">
          <span>🔐</span> Акаунт
        </h2>
        <div className="space-y-2">
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void handleLogout(false)}
            className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 py-3 text-sm font-semibold text-neutral-700 dark:text-neutral-300 disabled:opacity-60"
          >
            Вийти
          </button>
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => void handleLogout(true)}
            className="w-full rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 py-3 text-sm font-semibold text-red-600 dark:text-red-400 disabled:opacity-60"
          >
            Вийти на всіх пристроях
          </button>
        </div>
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
