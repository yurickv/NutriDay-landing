'use client';

import { useState } from 'react';
import { UserProfile } from '@/types/userProfile';
import { ChevronDown } from 'lucide-react';

const ACTIVITY_OPTIONS = [
  { value: '1.2', label: 'Сидячий (мінімум руху)' },
  { value: '1.375', label: 'Легка активність (1–3 тренування/тиж)' },
  { value: '1.55', label: 'Помірна активність (3–5 тренувань/тиж)' },
  { value: '1.725', label: 'Висока активність (6–7 тренувань/тиж)' },
  { value: '1.9', label: 'Дуже висока активність' },
];

const GOAL_OPTIONS = [
  { value: 'lose_weight', label: '📉 Схуднути' },
  { value: 'maintain_weight', label: '👀 Підтримувати вагу' },
  { value: 'gain_weight', label: '📈 Набрати вагу' },
  { value: 'build_muscle', label: "💪 Наростити м'язи" },
  { value: 'something_else', label: '💬 Щось інше' },
];

type Sex = 'male' | 'female';

function initialForm(profile: UserProfile | null) {
  return {
    sex: (profile?.sex === 'male' ? 'male' : 'female') as Sex,
    age: profile?.ageYears ? String(profile.ageYears) : '',
    weight: profile?.weightKg ? String(profile.weightKg) : '',
    height: profile?.heightCm ? String(profile.heightCm) : '',
    activity: profile?.activityLevel ? String(profile.activityLevel) : '1.375',
    mainGoal: profile?.mainGoal ?? 'lose_weight',
  };
}

export function BiometricsGoalEditor({
  profile,
  onSaved,
}: {
  profile: UserProfile | null;
  onSaved: () => void | Promise<void>;
}) {
  const isEdit = !!profile;
  // When a profile exists this is a collapsible "edit" section; otherwise it's
  // the always-open first-time setup card.
  const [open, setOpen] = useState(!isEdit);
  const [form, setForm] = useState(() => initialForm(profile));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.age || !form.weight || !form.height) {
      setError('Заповніть всі поля');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sex: form.sex,
          ageYears: parseInt(form.age, 10),
          weightKg: parseFloat(form.weight),
          heightCm: parseFloat(form.height),
          activityLevel: parseFloat(form.activity),
          mainGoal: form.mainGoal,
        }),
      });
      if (!res.ok) throw new Error('save failed');
      await onSaved();
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
      if (isEdit) setOpen(false);
    } catch {
      setError('Не вдалося зберегти. Спробуйте ще раз.');
    } finally {
      setSaving(false);
    }
  };

  const formBody = (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEdit && (
        <div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Налаштуйте профіль</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Вкажіть свої дані для персоналізованого меню</p>
        </div>
      )}

      {/* Sex */}
      <div className="flex gap-2">
        {(['female', 'male'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setForm((f) => ({ ...f, sex: s }))}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
              form.sex === s
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
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
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
          value={form.activity}
          onChange={(e) => setForm((f) => ({ ...f, activity: e.target.value }))}
          className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
        >
          {ACTIVITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Goal */}
      <div>
        <label className="text-xs text-neutral-500 mb-1 block">Ціль</label>
        <select
          value={form.mainGoal}
          onChange={(e) => setForm((f) => ({ ...f, mainGoal: e.target.value }))}
          className="w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
        >
          {GOAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-red-500 text-center">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-main text-white py-3 rounded-xl font-bold text-sm disabled:opacity-60"
      >
        {saving ? 'Зберігаємо…' : savedMsg ? '✓ Збережено' : isEdit ? 'Зберегти зміни' : 'Зберегти профіль'}
      </button>
    </form>
  );

  // First-time setup: always-open orange card (matches previous inline form).
  if (!isEdit) {
    return (
      <div className="mx-4 mt-4 rounded-2xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),_0_6px_24px_rgba(120,120,120,0.25)] p-5">
        {formBody}
      </div>
    );
  }

  // Existing profile: collapsible edit section.
  return (
    <section className="mx-4 mt-4 mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between rounded-2xl border border-orange-200 dark:border-orange-800/60 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/20 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),_0_6px_24px_rgba(120,120,120,0.25)] px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center shrink-0">
            <span className="text-xl">⚙️</span>
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Мої дані та ціль</p>
            {!open && (
              <p className="text-xs text-neutral-500 mt-0.5">
                {[
                  profile?.weightKg && `${profile.weightKg} кг`,
                  profile?.heightCm && `${profile.heightCm} см`,
                  profile?.ageYears && `${profile.ageYears} р.`,
                ].filter(Boolean).join(' · ') || 'Натисніть щоб переглянути'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!open && (
            <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
              Змінити
            </span>
          )}
          <ChevronDown
            size={18}
            className={`text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {open && (
        <div className="mt-2 rounded-2xl border border-orange-100 dark:border-orange-900/30 bg-white dark:bg-neutral-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),_0_6px_24px_rgba(120,120,120,0.25)] p-4">
          {formBody}
        </div>
      )}
    </section>
  );
}
