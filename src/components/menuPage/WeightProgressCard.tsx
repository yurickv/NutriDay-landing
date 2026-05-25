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
      <div className="mx-4 my-3 h-28 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />
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
    ? 'text-neutral-400'
    : totalDelta < 0
    ? 'text-green-600 dark:text-green-400'
    : totalDelta > 0
    ? 'text-orange-500'
    : 'text-neutral-500';

  return (
    <div className="mx-4 my-3 rounded-2xl bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/30 border border-purple-100 dark:border-purple-900/40 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚖️</span>
          <div>
            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-100">Вага</p>
            {lastWeight ? (
              <p className="text-xs text-neutral-500">
                Зараз: <span className="font-semibold">{lastWeight} кг</span>
                {totalDelta !== null && totalDelta !== 0 && (
                  <span className={`ml-1 ${deltaColor}`}>
                    ({totalDelta > 0 ? '+' : ''}{totalDelta} кг)
                  </span>
                )}
              </p>
            ) : (
              <p className="text-xs text-neutral-400">Зважтесь та зафіксуйте результат</p>
            )}
          </div>
        </div>

        <button
          onClick={() => setShowInput(!showInput)}
          className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-white dark:bg-neutral-800 border border-purple-200 dark:border-purple-800 px-3 py-1.5 rounded-xl active:scale-95 transition-transform"
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
                className="flex-1 rounded-t bg-purple-300 dark:bg-purple-700 opacity-70"
                style={{ height: `${heightPct}%` }}
                title={`${log.weight} кг`}
              />
            );
          })}
        </div>
      )}

      {/* Input */}
      {showInput && (
        <div className="mt-3 pt-3 border-t border-purple-100 dark:border-purple-900/40 space-y-2">
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              min="20"
              max="300"
              value={inputWeight}
              onChange={(e) => setInputWeight(e.target.value)}
              placeholder="Кг (напр. 68.5)"
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <button
              onClick={() => { void handleSave(); }}
              disabled={saving || !inputWeight}
              className="px-4 py-2 text-sm font-semibold bg-purple-500 text-white rounded-xl active:scale-95 transition-transform disabled:opacity-50"
            >
              {saving ? '…' : 'Зберегти'}
            </button>
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Нотатка (необов'язково)"
            className="w-full px-3 py-2 text-sm rounded-xl border border-purple-200 dark:border-purple-800 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
      )}
    </div>
  );
}
