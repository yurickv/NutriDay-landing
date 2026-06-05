'use client';

import { useState } from 'react';
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
    <section className="mx-4 mb-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between rounded-2xl border border-green-200 dark:border-green-800/60 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/20 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),_0_6px_24px_rgba(120,120,120,0.25)] px-4 py-3.5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center shrink-0">
            <span className="text-xl">🥦</span>
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-900 dark:text-neutral-100">Мої вподобання</p>
            {!expanded && (dietaryPreferences.length > 0 || favoriteFoods.length > 0 || allergies.length > 0) && (
              <p className="text-xs text-neutral-500 mt-0.5 truncate max-w-[180px]">
                {[...dietaryPreferences, ...favoriteFoods].slice(0, 3).join(', ')}
                {dietaryPreferences.length + favoriteFoods.length > 3 ? '…' : ''}
              </p>
            )}
            {!expanded && dietaryPreferences.length === 0 && favoriteFoods.length === 0 && allergies.length === 0 && (
              <p className="text-xs text-neutral-400 mt-0.5">Налаштуйте для кращого меню</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!expanded && (
            <span className="text-xs font-medium text-green-600 dark:text-green-400">
              Змінити
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-neutral-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="mt-2 px-4 pt-4 pb-5 rounded-2xl border border-neutral-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07),_0_6px_24px_rgba(120,120,120,0.25)] space-y-5">

          {/* Dietary preferences */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
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
                        ? 'bg-orange-50 dark:bg-orange-950/50 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300'
                        : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
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
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
              Улюблені продукти
            </p>
            <TagInput
              tags={favoriteFoods}
              onChange={setFavoriteFoods}
              placeholder="Гречка, курятина, броколі... (Enter)"
            />
            <p className="text-xs text-neutral-400 mt-1">AI буде додавати їх частіше</p>
          </div>

          {/* Disliked foods */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
              НЕ включати
            </p>
            <TagInput
              tags={dislikedFoods}
              onChange={setDislikedFoods}
              placeholder="Баклажани, печінка... (Enter)"
            />
            <p className="text-xs text-neutral-400 mt-1">AI виключить ці продукти з меню</p>
          </div>

          {/* Allergies */}
          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">
              Алергії
            </p>
            <TagInput
              tags={allergies}
              onChange={setAllergies}
              placeholder="Горіхи, молоко, яйця... (Enter)"
            />
            <p className="text-xs text-red-400 mt-1">⚠️ AI суворо уникатиме цих продуктів</p>
          </div>

          {/* Save button */}
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
              saved
                ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800'
                : hasChanges
                ? 'bg-main-button text-white shadow-sm active:scale-95'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 cursor-not-allowed'
            }`}
          >
            <Save size={15} />
            {saving ? 'Збереження...' : saved ? 'Збережено ✓' : 'Зберегти вподобання'}
          </button>

          {hasChanges && !saved && (
            <p className="text-xs text-center text-orange-500">
              💡 Зміни будуть враховані при наступній генерації меню
            </p>
          )}
        </div>
      )}
    </section>
  );
}
