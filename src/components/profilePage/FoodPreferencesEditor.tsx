'use client';

import { useState } from 'react';
import { Collapsible } from '@/components/common/Collapsible';
import { TagInput } from '@/components/common/TagInput';
import { UserProfile } from '@/types/userProfile';
import { ChevronDown, Save } from 'lucide-react';

const DIETARY_OPTIONS = [
  { value: 'вегетаріанське', label: '🥗 Вегетаріанське' },
  { value: 'веганське', label: '🌱 Веганське' },
  { value: 'без глютену', label: '🌾 Без глютену' },
  { value: 'без молочних', label: '🥛 Без молочних' },
  { value: 'без свинини', label: '🐷 Без свинини' },
  { value: 'без морепродуктів', label: '🦐 Без морепродуктів' },
  { value: 'кето', label: '🥑 Кето' },
  { value: 'без цукру', label: '🍬 Без цукру' },
];

interface FoodPreferencesEditorProps {
  profile: UserProfile;
  onSaved?: (updatedFields: Partial<UserProfile>) => void;
}

export function FoodPreferencesEditor({ profile, onSaved }: FoodPreferencesEditorProps) {
  const [expanded, setExpanded] = useState(false);
  const [favoriteFoods, setFavoriteFoods] = useState<string[]>(profile.favoriteFoods ?? []);
  const [dislikedFoods, setDislikedFoods] = useState<string[]>(profile.dislikedFoods ?? []);
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>(profile.dietaryPreferences ?? []);
  const [allergies, setAllergies] = useState<string[]>(profile.allergies ?? []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDietary(value: string) {
    setDietaryPreferences((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/profile/food-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favoriteFoods, dislikedFoods, dietaryPreferences, allergies }),
      });
      if (!res.ok) throw new Error('Помилка збереження');
      setSaved(true);
      onSaved?.({ favoriteFoods, dislikedFoods, dietaryPreferences, allergies });
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Не вдалося зберегти. Спробуйте ще раз.');
    } finally {
      setSaving(false);
    }
  }

  const hasChanges =
    JSON.stringify(favoriteFoods) !== JSON.stringify(profile.favoriteFoods ?? []) ||
    JSON.stringify(dislikedFoods) !== JSON.stringify(profile.dislikedFoods ?? []) ||
    JSON.stringify(dietaryPreferences) !== JSON.stringify(profile.dietaryPreferences ?? []) ||
    JSON.stringify(allergies) !== JSON.stringify(profile.allergies ?? []);

  return (
    <section className="mx-4 mb-4 rounded-2xl bg-card dark:bg-night-card shadow-soft overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-cream dark:bg-night flex items-center justify-center shrink-0">
            <span className="text-xl">🥦</span>
          </div>
          <div>
            <p className="text-sm font-heading font-semibold text-ink dark:text-night-ink">Мої вподобання</p>
            {!expanded && (dietaryPreferences.length > 0 || favoriteFoods.length > 0 || allergies.length > 0) && (
              <p className="text-xs text-ink/60 dark:text-night-muted mt-0.5 truncate max-w-[180px]">
                {[...dietaryPreferences, ...favoriteFoods].slice(0, 3).join(', ')}
                {dietaryPreferences.length + favoriteFoods.length > 3 ? '…' : ''}
              </p>
            )}
            {!expanded && dietaryPreferences.length === 0 && favoriteFoods.length === 0 && allergies.length === 0 && (
              <p className="text-xs text-ink/40 dark:text-night-muted mt-0.5">Налаштуйте для кращого меню</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!expanded && (
            <span className="text-xs font-medium text-terracotta dark:text-terracotta-light">
              Змінити
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-ink/40 dark:text-night-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      <Collapsible open={expanded} className="px-4 pt-1 pb-5 space-y-5">

        {/* Dietary preferences */}
        <div>
          <p className="text-xs font-semibold text-ink/50 dark:text-night-muted uppercase tracking-wide mb-2">
            Тип харчування
          </p>
          <div className="flex flex-wrap gap-2">
            {DIETARY_OPTIONS.map(({ value, label }) => {
              const active = dietaryPreferences.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleDietary(value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-sage border-sage text-card'
                      : 'bg-cream dark:bg-night border-ink/10 dark:border-night-ink/10 text-ink/60 dark:text-night-muted'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Favorite foods */}
        <div>
          <p className="text-xs font-semibold text-ink/50 dark:text-night-muted uppercase tracking-wide mb-2">
            Улюблені продукти
          </p>
          <TagInput
            tags={favoriteFoods}
            onChange={setFavoriteFoods}
            placeholder="Гречка, курятина, броколі... (Enter)"
          />
          <p className="text-xs text-ink/50 dark:text-night-muted mt-1">AI буде додавати їх частіше</p>
        </div>

        {/* Disliked foods */}
        <div>
          <p className="text-xs font-semibold text-ink/50 dark:text-night-muted uppercase tracking-wide mb-2">
            НЕ включати
          </p>
          <TagInput
            tags={dislikedFoods}
            onChange={setDislikedFoods}
            placeholder="Баклажани, печінка... (Enter)"
          />
          <p className="text-xs text-ink/50 dark:text-night-muted mt-1">AI виключить ці продукти з меню</p>
        </div>

        {/* Allergies */}
        <div>
          <p className="text-xs font-semibold text-ink/50 dark:text-night-muted uppercase tracking-wide mb-2">
            Алергії
          </p>
          <TagInput
            tags={allergies}
            onChange={setAllergies}
            placeholder="Горіхи, молоко, яйця... (Enter)"
          />
          <p className="text-xs text-terracotta-dark dark:text-terracotta-light mt-1">⚠️ AI суворо уникатиме цих продуктів</p>
        </div>

        {/* Save button */}
        {error && (
          <p className="text-xs text-danger dark:text-danger-dark">{error}</p>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold transition-all ${
            saved
              ? 'bg-sage-light/40 dark:bg-sage/20 border border-sage-light dark:border-sage/40 text-sage-dark dark:text-sage-light'
              : hasChanges
              ? 'bg-terracotta hover:bg-terracotta-dark text-card shadow-soft active:scale-95'
              : 'bg-cream dark:bg-night text-ink/40 dark:text-night-muted cursor-not-allowed'
          }`}
        >
          <Save size={15} />
          {saving ? 'Збереження...' : saved ? 'Збережено ✓' : 'Зберегти вподобання'}
        </button>

        {hasChanges && !saved && (
          <p className="text-xs text-center text-ink/60 dark:text-night-muted">
            💡 Зміни будуть враховані при наступній генерації меню
          </p>
        )}
      </Collapsible>
    </section>
  );
}
