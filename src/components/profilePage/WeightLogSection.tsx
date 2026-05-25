'use client';

import { useState } from 'react';
import { useWeightLog } from '@/hooks/useWeightLog';
import { track } from '@/lib/analytics';
import { WeightLog } from '@/types/engagement';

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

export function WeightLogSection() {
  const { logs, loading, saving, addWeight, lastWeight, totalDelta } = useWeightLog();
  const [inputWeight, setInputWeight] = useState('');
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleSave = async () => {
    const w = parseFloat(inputWeight);
    if (!w || w < 20 || w > 300) return;
    const ok = await addWeight(w, note || undefined);
    if (ok) {
      track('weight_logged', { delta: totalDelta ?? 0 });
      setInputWeight('');
      setNote('');
      setShowForm(false);
    }
  };

  const deltaColor = totalDelta === null
    ? ''
    : totalDelta < 0
    ? 'text-green-600 dark:text-green-400'
    : totalDelta > 0
    ? 'text-orange-500'
    : 'text-neutral-400';

  return (
    <section className="px-4 py-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
          <span>⚖️</span> Трекер ваги
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 px-3 py-1.5 rounded-xl"
        >
          + Зважитись
        </button>
      </div>

      {/* Summary */}
      {lastWeight && (
        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-purple-50 dark:bg-purple-950/30 rounded-2xl p-3 text-center">
            <p className="text-xs text-neutral-400 mb-1">Зараз</p>
            <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{lastWeight} кг</p>
          </div>
          {totalDelta !== null && (
            <div className="flex-1 bg-green-50 dark:bg-green-950/30 rounded-2xl p-3 text-center">
              <p className="text-xs text-neutral-400 mb-1">Зміна</p>
              <p className={`text-lg font-bold ${deltaColor}`}>
                {totalDelta > 0 ? '+' : ''}{totalDelta} кг
              </p>
            </div>
          )}
          <div className="flex-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl p-3 text-center">
            <p className="text-xs text-neutral-400 mb-1">Записів</p>
            <p className="text-lg font-bold text-neutral-900 dark:text-neutral-100">{logs.length}</p>
          </div>
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <div className="mb-4 bg-white dark:bg-neutral-800 border border-purple-200 dark:border-purple-800 rounded-2xl p-4 space-y-3">
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              min="20"
              max="300"
              value={inputWeight}
              onChange={(e) => setInputWeight(e.target.value)}
              placeholder="Вага, кг (напр. 68.5)"
              className="flex-1 px-3 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <button
              onClick={() => { void handleSave(); }}
              disabled={saving || !inputWeight}
              className="px-4 py-2.5 text-sm font-semibold bg-purple-500 text-white rounded-xl active:scale-95 transition-transform disabled:opacity-50"
            >
              {saving ? '…' : 'Зберегти'}
            </button>
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Нотатка (необов'язково)"
            className="w-full px-3 py-2.5 text-sm rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && logs.length === 0 && (
        <div className="text-center py-8 text-neutral-400">
          <p className="text-3xl mb-2">⚖️</p>
          <p className="text-sm">Додайте першу позначку ваги<br />і відстежуйте прогрес</p>
          <p className="text-xs mt-2 text-neutral-300">Рекомендується: 1 раз на тиждень, вранці</p>
        </div>
      )}

      {/* Log list */}
      {!loading && logs.length > 0 && (
        <div className="space-y-2">
          {[...logs].reverse().slice(0, 15).map((log: WeightLog, i) => {
            const prev = [...logs].reverse()[i + 1];
            const delta = prev ? Math.round((log.weight - prev.weight) * 10) / 10 : null;
            const dColor = delta === null
              ? ''
              : delta < 0
              ? 'text-green-600 dark:text-green-400'
              : delta > 0
              ? 'text-orange-500'
              : 'text-neutral-400';

            return (
              <div
                key={i}
                className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/50 rounded-xl px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                    {log.weight} кг
                  </p>
                  {log.note && (
                    <p className="text-xs text-neutral-400">{log.note}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-400">{formatDate(log.date)}</p>
                  {delta !== null && (
                    <p className={`text-xs font-semibold ${dColor}`}>
                      {delta > 0 ? '+' : ''}{delta} кг
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
