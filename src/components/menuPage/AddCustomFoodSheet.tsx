'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Minus, Plus, Sparkles, Pencil, Scale, Trash2 } from 'lucide-react';
import { BottomSheet } from '@/components/common/BottomSheet';
import { CustomEntry, MealIngredient, NutritionPer100 } from '@/types/meals';

interface AddCustomFoodSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (entry: Omit<CustomEntry, 'id' | 'createdAt'>) => Promise<void>;
}

// Shape returned by POST /api/menu/food/parse.
interface ParsedResponse {
  name: string;
  emoji: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  grams: number;
  per100: NutritionPer100 | null;
  ingredients: MealIngredient[];
  method: 'ingredients' | 'estimate';
  error: string | null;
}

const STEP = 10; // grams

interface Draft {
  name: string;
  emoji: string;
  grams: number; // 0 = вага не вказана
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  per100: NutritionPer100 | null;
  ingredients: MealIngredient[];
  mode: 'ingredients' | 'estimate';
  source: 'ai' | 'manual';
}

const EMPTY_DRAFT: Draft = {
  name: '',
  emoji: '🍽️',
  grams: 0,
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
  per100: null,
  ingredients: [],
  mode: 'estimate',
  source: 'manual',
};

function clampNum(v: string): number {
  const n = Math.round(Number(v) || 0);
  return n >= 0 ? n : 0;
}

export function AddCustomFoodSheet({ isOpen, onClose, onAdd }: AddCustomFoodSheetProps) {
  const [step, setStep] = useState<'input' | 'edit'>('input');
  const [text, setText] = useState('');
  const [weight, setWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const computeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset everything whenever the sheet is (re)opened.
  useEffect(() => {
    if (isOpen) {
      setStep('input');
      setText('');
      setWeight('');
      setLoading(false);
      setSaving(false);
      setRecomputing(false);
      setNote(null);
      setDraft(EMPTY_DRAFT);
    }
  }, [isOpen]);

  // Clear any pending debounce on unmount.
  useEffect(() => () => {
    if (computeTimer.current) clearTimeout(computeTimer.current);
  }, []);

  const handleParse = async () => {
    const trimmed = text.trim();
    const grams = Math.round(Number(weight));
    if (!trimmed || !(grams > 0)) return;
    setLoading(true);
    setNote(null);
    try {
      const res = await fetch('/api/menu/food/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, grams }),
      });
      const data = (await res.json()) as { parsed?: ParsedResponse };
      const p = data.parsed;

      if (!res.ok || !p || p.error) {
        setDraft({ ...EMPTY_DRAFT, name: trimmed.slice(0, 30), grams });
        setNote(p?.error ?? 'Не вдалося розпізнати. Введіть БЖВ вручну.');
      } else {
        setDraft({
          name: p.name || trimmed.slice(0, 30),
          emoji: p.emoji || '🍽️',
          grams: p.grams || grams,
          calories: p.calories,
          protein: p.protein,
          fat: p.fat,
          carbs: p.carbs,
          per100: p.per100,
          ingredients: p.ingredients ?? [],
          mode: p.method === 'ingredients' && (p.ingredients?.length ?? 0) > 0 ? 'ingredients' : 'estimate',
          source: 'ai',
        });
      }
      setStep('edit');
    } catch {
      setDraft({ ...EMPTY_DRAFT, name: trimmed.slice(0, 30), grams });
      setNote('Помилка зʼєднання. Введіть БЖВ вручну.');
      setStep('edit');
    } finally {
      setLoading(false);
    }
  };

  // Debounced deterministic recompute from the current ingredient list.
  const scheduleRecompute = (ingredients: MealIngredient[]) => {
    if (computeTimer.current) clearTimeout(computeTimer.current);
    if (ingredients.length === 0) return;
    setRecomputing(true);
    computeTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/menu/food/compute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ingredients }),
        });
        if (res.ok) {
          const c = (await res.json()) as {
            calories: number; protein: number; fat: number; carbs: number;
            grams: number; per100: NutritionPer100;
          };
          setDraft((d) => ({
            ...d,
            calories: c.calories,
            protein: c.protein,
            fat: c.fat,
            carbs: c.carbs,
            grams: c.grams,
            per100: c.per100,
          }));
        }
      } finally {
        setRecomputing(false);
      }
    }, 400);
  };

  const updateIngredient = (idx: number, field: 'name' | 'quantity', value: string) => {
    setDraft((d) => {
      const ingredients = d.ingredients.map((ing, i) =>
        i === idx
          ? { ...ing, [field]: field === 'quantity' ? clampNum(value) : value.slice(0, 60) }
          : ing,
      );
      scheduleRecompute(ingredients);
      return { ...d, ingredients };
    });
  };

  const removeIngredient = (idx: number) => {
    setDraft((d) => {
      const ingredients = d.ingredients.filter((_, i) => i !== idx);
      scheduleRecompute(ingredients);
      return { ...d, ingredients };
    });
  };

  const addIngredient = () => {
    setDraft((d) => ({
      ...d,
      ingredients: [...d.ingredients, { name: '', quantity: 0, unit: 'г', shoppingCategory: 'other' }],
    }));
  };

  const setGrams = (next: number) => {
    const grams = Math.max(0, next);
    setDraft((d) => {
      if (d.per100 && grams > 0) {
        const f = grams / 100;
        return {
          ...d,
          grams,
          calories: Math.round(d.per100.calories * f),
          protein: Math.round(d.per100.protein * f),
          fat: Math.round(d.per100.fat * f),
          carbs: Math.round(d.per100.carbs * f),
        };
      }
      return { ...d, grams };
    });
  };

  const handleManualField = (field: 'name' | 'emoji' | 'calories' | 'protein' | 'fat' | 'carbs', value: string) => {
    setDraft((d) => {
      if (field === 'name') return { ...d, name: value.slice(0, 30) };
      if (field === 'emoji') return { ...d, emoji: value.slice(0, 8) };
      return { ...d, [field]: clampNum(value), per100: null };
    });
  };

  const handleSave = async () => {
    if (!draft.name.trim() || saving) return;
    setSaving(true);
    try {
      await onAdd({
        name: draft.name.trim(),
        emoji: draft.emoji || '🍽️',
        calories: draft.calories,
        protein: draft.protein,
        fat: draft.fat,
        carbs: draft.carbs,
        grams: draft.grams > 0 ? draft.grams : null,
        per100: draft.per100,
        ingredients: draft.mode === 'ingredients' && draft.ingredients.length > 0 ? draft.ingredients : undefined,
        source: draft.source,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const macroSummary = (
    <div className="grid grid-cols-4 gap-2">
      {([
        { key: 'calories', label: 'Ккал' },
        { key: 'protein', label: 'Б, г' },
        { key: 'fat', label: 'Ж, г' },
        { key: 'carbs', label: 'В, г' },
      ] as const).map(({ key, label }) => (
        <div key={key} className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-semibold text-neutral-400 uppercase">{label}</span>
          <span className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{draft[key]}</span>
        </div>
      ))}
    </div>
  );

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Додати свою страву">
      {step === 'input' ? (
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-neutral-500">
            Вкажіть назву страви та її вагу — AI оцінить калорії та БЖВ, які можна підправити.
          </p>

          <div className="space-y-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Назва страви, напр.: гречка з куркою"
              autoFocus
              maxLength={200}
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-orange-400"
            />
            <div className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus-within:border-orange-400">
              <input
                type="number"
                inputMode="numeric"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="Вага порції"
                min={1}
                className="flex-1 min-w-0 bg-transparent text-sm text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none"
              />
              <span className="text-sm font-semibold text-neutral-400">г</span>
            </div>
          </div>

          <p className="text-[11px] text-neutral-400 flex items-start gap-1.5">
            <Scale size={13} className="mt-0.5 flex-shrink-0" />
            Точна вага страви робить підрахунок калорій і БЖВ значно точнішим.
          </p>

          <button
            onClick={handleParse}
            disabled={!text.trim() || !(Number(weight) > 0) || loading}
            className="w-full flex items-center justify-center gap-2 bg-main text-white font-bold py-3.5 rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            <Sparkles size={18} />
            {loading ? 'Рахуємо…' : 'Розрахувати'}
          </button>
          <button
            onClick={() => {
              const grams = Math.round(Number(weight)) || 0;
              setDraft({ ...EMPTY_DRAFT, name: text.trim().slice(0, 30), grams });
              setNote(null);
              setStep('edit');
            }}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-600 py-1"
          >
            <Pencil size={12} />
            Ввести вручну
          </button>
        </div>
      ) : (
        <div className="px-5 py-4 space-y-4">
          {note && (
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2">
              {note}
            </p>
          )}

          {/* Name + emoji */}
          <div className="flex gap-2">
            <input
              type="text"
              value={draft.emoji}
              onChange={(e) => handleManualField('emoji', e.target.value)}
              className="w-14 text-center text-2xl px-2 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:border-orange-400"
              aria-label="Емодзі"
            />
            <input
              type="text"
              value={draft.name}
              onChange={(e) => handleManualField('name', e.target.value)}
              placeholder="Назва страви"
              maxLength={30}
              className="flex-1 text-sm px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-orange-400"
            />
          </div>

          {draft.mode === 'ingredients' ? (
            <>
              {/* Editable ingredient list */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-500">Інгредієнти</span>
                  <span className="text-[11px] text-neutral-400">
                    {recomputing ? 'Перерахунок…' : `${draft.grams} г разом`}
                  </span>
                </div>
                {draft.ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                      placeholder="Інгредієнт"
                      className="flex-1 min-w-0 text-sm px-2.5 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none focus:border-orange-400"
                    />
                    <div className="flex items-center gap-1 w-24 px-2 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 focus-within:border-orange-400">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={ing.quantity}
                        onChange={(e) => updateIngredient(idx, 'quantity', e.target.value)}
                        className="w-full min-w-0 bg-transparent text-sm text-right text-neutral-800 dark:text-neutral-200 focus:outline-none"
                        aria-label="Кількість"
                      />
                      <span className="text-[11px] font-semibold text-neutral-400">{ing.unit}</span>
                    </div>
                    <button
                      onClick={() => removeIngredient(idx)}
                      className="p-2 text-neutral-400 hover:text-red-500"
                      aria-label="Видалити інгредієнт"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addIngredient}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-neutral-500 hover:text-orange-500 py-2 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700"
                >
                  <Plus size={14} />
                  Додати інгредієнт
                </button>
              </div>

              {/* Read-only computed totals */}
              <div className="bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-3">{macroSummary}</div>
            </>
          ) : (
            <>
              {/* Weight stepper */}
              <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800 rounded-2xl p-3">
                <button
                  onClick={() => setGrams(draft.grams - STEP)}
                  disabled={draft.grams <= 0}
                  className="w-10 h-10 rounded-full bg-white dark:bg-neutral-700 shadow flex items-center justify-center disabled:opacity-40"
                  aria-label="Зменшити вагу"
                >
                  <Minus size={16} />
                </button>
                <div className="text-center">
                  <div className="flex items-baseline gap-1 justify-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={draft.grams}
                      onChange={(e) => setGrams(Math.max(0, Number(e.target.value) || 0))}
                      className="w-20 bg-transparent text-center text-2xl font-bold text-neutral-900 dark:text-neutral-100 focus:outline-none"
                      aria-label="Вага в грамах"
                    />
                    <span className="text-sm font-semibold text-neutral-400">г</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {draft.per100 ? 'вага перераховує калорії' : 'вага порції'}
                  </p>
                </div>
                <button
                  onClick={() => setGrams(draft.grams + STEP)}
                  className="w-10 h-10 rounded-full bg-white dark:bg-neutral-700 shadow flex items-center justify-center"
                  aria-label="Збільшити вагу"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Editable calories + macros */}
              <div className="grid grid-cols-4 gap-2">
                {([
                  { key: 'calories', label: 'Ккал' },
                  { key: 'protein', label: 'Б, г' },
                  { key: 'fat', label: 'Ж, г' },
                  { key: 'carbs', label: 'В, г' },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-neutral-400 text-center uppercase">
                      {label}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={draft[key]}
                      onChange={(e) => handleManualField(key, e.target.value)}
                      className="w-full text-center text-sm font-bold px-1 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-orange-400"
                    />
                  </label>
                ))}
              </div>
            </>
          )}

          {/* Confirm */}
          <button
            onClick={handleSave}
            disabled={!draft.name.trim() || saving || recomputing}
            className="w-full flex items-center justify-center gap-2 bg-green-500 text-white font-bold py-3.5 rounded-2xl disabled:opacity-50 active:scale-[0.98] transition-transform"
          >
            <Check size={18} strokeWidth={3} />
            {saving ? 'Додаємо…' : 'Додати'}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
