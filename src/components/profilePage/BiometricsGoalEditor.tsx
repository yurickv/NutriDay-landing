'use client';

import { useState } from 'react';
import { UserProfile } from '@/types/userProfile';
import { Collapsible } from '@/components/common/Collapsible';
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

const INPUT_CLASS =
  'w-full rounded-xl border border-ink/10 dark:border-night-ink/10 bg-card dark:bg-night-card px-3 py-2 text-sm text-ink dark:text-night-ink focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage-light/50';

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
          <h2 className="font-heading font-semibold text-base text-ink dark:text-night-ink">Налаштуйте профіль</h2>
          <p className="text-xs text-ink/60 dark:text-night-muted mt-0.5">Вкажіть свої дані для персоналізованого меню</p>
        </div>
      )}

      {/* Sex */}
      <div className="flex gap-2">
        {(['female', 'male'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setForm((f) => ({ ...f, sex: s }))}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold border active:scale-95 transition-all ${
              form.sex === s
                ? 'bg-sage text-card border-sage'
                : 'bg-card dark:bg-night-card border-sage-light dark:border-sage/40 text-sage-dark dark:text-sage-light'
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
            <label className="text-xs text-ink/60 dark:text-night-muted mb-1 block">{label}</label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className={`${INPUT_CLASS} pr-7`}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink/40 dark:text-night-muted">{unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Activity */}
      <div>
        <label className="text-xs text-ink/60 dark:text-night-muted mb-1 block">Рівень активності</label>
        <select
          value={form.activity}
          onChange={(e) => setForm((f) => ({ ...f, activity: e.target.value }))}
          className={INPUT_CLASS}
        >
          {ACTIVITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Goal */}
      <div>
        <label className="text-xs text-ink/60 dark:text-night-muted mb-1 block">Ціль</label>
        <select
          value={form.mainGoal}
          onChange={(e) => setForm((f) => ({ ...f, mainGoal: e.target.value }))}
          className={INPUT_CLASS}
        >
          {GOAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-xs text-danger dark:text-danger-dark text-center">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className={`w-full py-3 rounded-2xl font-semibold text-sm active:scale-95 transition-all disabled:opacity-60 ${
          savedMsg
            ? 'bg-sage-light/40 dark:bg-sage/20 border border-sage-light dark:border-sage/40 text-sage-dark dark:text-sage-light'
            : 'bg-terracotta hover:bg-terracotta-dark text-card shadow-soft'
        }`}
      >
        {saving ? 'Зберігаємо…' : savedMsg ? '✓ Збережено' : isEdit ? 'Зберегти зміни' : 'Зберегти профіль'}
      </button>
    </form>
  );

  // First-time setup: always-open card (matches previous inline form).
  if (!isEdit) {
    return (
      <div className="mx-4 mt-4 rounded-2xl bg-card dark:bg-night-card shadow-soft p-5">
        {formBody}
      </div>
    );
  }

  // Existing profile: collapsible edit section.
  return (
    <section className="mx-4 mt-4 mb-4 rounded-2xl bg-card dark:bg-night-card shadow-soft overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cream dark:bg-night flex items-center justify-center shrink-0">
            <span className="text-xl">⚙️</span>
          </div>
          <div>
            <p className="text-sm font-heading font-semibold text-ink dark:text-night-ink">Мої дані та ціль</p>
            {!open && (
              <p className="text-xs text-ink/60 dark:text-night-muted mt-0.5">
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
            <span className="text-xs font-medium text-terracotta dark:text-terracotta-light">
              Змінити
            </span>
          )}
          <ChevronDown
            size={18}
            className={`text-ink/40 dark:text-night-muted transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      <Collapsible open={open} className="px-4 pb-4 pt-1">
        {formBody}
      </Collapsible>
    </section>
  );
}
