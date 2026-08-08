'use client';

import { useState } from 'react';
import { useWeightLog } from '@/hooks/useWeightLog';
import { track } from '@/lib/analytics';

export function WeightProgressCard() {
  const { logs, loading, saving, addWeight, lastWeight, totalDelta } = useWeightLog();
  const [inputWeight, setInputWeight] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [note, setNote] = useState('');

  if (loading) {
    return (
      <div className="mx-4 my-3 h-28 bg-ink/10 dark:bg-night-ink/10 rounded-2xl animate-pulse" />
    );
  }

  const handleSave = async () => {
    const w = parseFloat(inputWeight);
    if (!w || w < 20 || w > 300) return;

    const ok = await addWeight(w, note || undefined);
    if (ok) {
      track('weight_logged', { delta: totalDelta ?? 0 });
      setInputWeight('');
      setNote('');
      setShowInput(false);
      if ('vibrate' in navigator) navigator.vibrate(40);
    }
  };

  const deltaColor = totalDelta === null
    ? 'text-ink/60 dark:text-night-muted'
    : totalDelta < 0
    ? 'text-sage-dark dark:text-sage-light'
    : totalDelta > 0
    ? 'text-terracotta'
    : 'text-ink/60 dark:text-night-muted';

  return (
    <div className="mx-4 my-3 rounded-2xl bg-card dark:bg-night-card shadow-soft p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚖️</span>
          <div>
            <p className="text-sm font-bold text-ink dark:text-night-ink">Вага</p>
            {lastWeight ? (
              <p className="text-xs text-ink/60 dark:text-night-muted">
                Зараз: <span className="font-semibold">{lastWeight} кг</span>
                {totalDelta !== null && totalDelta !== 0 && (
                  <span className={`ml-1 ${deltaColor}`}>
                    ({totalDelta > 0 ? '+' : ''}{totalDelta} кг)
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-ink/60 dark:text-night-muted">Зважтесь та зафіксуйте результат</p>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowInput(!showInput)}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-card dark:bg-night-card border border-sage-light dark:border-sage/40 text-sage-dark dark:text-sage-light active:scale-95 transition-all"
        >
          + Додати
        </button>
      </div>

      {/* Sparkline — simplified bar chart for last 7 entries */}
      {logs.length >= 2 && (
        <div className="mt-3 flex items-end gap-1 h-8">
          {logs.slice(-7).map((log, i) => {
            const allWeights = logs.slice(-7).map((l) => l.weight);
            const min = Math.min(...allWeights);
            const max = Math.max(...allWeights);
            const range = max - min || 1;
            const heightPct = Math.max(15, Math.round(((log.weight - min) / range) * 100));
            return (
              <div
                key={i}
                className="flex-1 rounded-t bg-sage-light dark:bg-sage/40 opacity-70"
                style={{ height: `${heightPct}%` }}
                title={`${log.weight} кг`}
              />
            );
          })}
        </div>
      )}

      {/* Input */}
      {showInput && (
        <div className="mt-3 pt-3 border-t border-ink/10 dark:border-night-ink/10 space-y-2">
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              min="20"
              max="300"
              value={inputWeight}
              onChange={(e) => setInputWeight(e.target.value)}
              placeholder="Кг (напр. 68.5)"
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-ink/10 dark:border-night-ink/10 bg-card dark:bg-night-card text-ink dark:text-night-ink focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage-light/50"
            />
            <button
              onClick={() => { void handleSave(); }}
              disabled={saving || !inputWeight}
              className="px-4 py-2 text-sm font-semibold bg-terracotta hover:bg-terracotta-dark text-card rounded-2xl shadow-soft active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? '…' : 'Зберегти'}
            </button>
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Нотатка (необов'язково)"
            className="w-full px-3 py-2 text-sm rounded-xl border border-ink/10 dark:border-night-ink/10 bg-card dark:bg-night-card text-ink dark:text-night-ink focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage-light/50"
          />
        </div>
      )}
    </div>
  );
}
