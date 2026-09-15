'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useWeightLog } from '@/hooks/useWeightLog';
import { track } from '@/lib/analytics';
import { WeightLog } from '@/types/engagement';

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

const INPUT_CLASS =
  'px-3 py-2.5 text-sm rounded-xl border border-ink/10 dark:border-night-ink/10 bg-card dark:bg-night-card text-ink dark:text-night-ink focus:outline-none focus:border-sage focus:ring-2 focus:ring-sage-light/50';

export function WeightLogSection() {
  const { logs, loading, saving, addWeight, lastWeight, totalDelta } = useWeightLog();
  const [inputWeight, setInputWeight] = useState('');
  const [note, setNote] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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
    ? 'text-sage-dark dark:text-sage-light'
    : totalDelta > 0
    ? 'text-terracotta'
    : 'text-ink/60 dark:text-night-muted';

  return (
    <section className="mx-4 mb-4">
      <div className="rounded-2xl bg-card dark:bg-night-card shadow-soft p-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold text-base text-ink dark:text-night-ink flex items-center gap-2">
            <span>⚖️</span> Трекер ваги
          </h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-card dark:bg-night-card border border-sage-light dark:border-sage/40 text-sage-dark dark:text-sage-light active:scale-95 transition-all"
          >
            + Зважитись
          </button>
        </div>

        {/* Summary */}
        {lastWeight && (
          <div className="flex gap-3 mb-4">
            <div className="flex-1 bg-cream dark:bg-night rounded-xl p-3 text-center">
              <p className="text-xs text-ink/50 dark:text-night-muted mb-1">Зараз</p>
              <p className="text-lg font-heading font-bold text-ink dark:text-night-ink">{lastWeight} кг</p>
            </div>
            {totalDelta !== null && (
              <div className="flex-1 bg-cream dark:bg-night rounded-xl p-3 text-center">
                <p className="text-xs text-ink/50 dark:text-night-muted mb-1">Зміна</p>
                <p className={`text-lg font-heading font-bold ${deltaColor}`}>
                  {totalDelta > 0 ? '+' : ''}{totalDelta} кг
                </p>
              </div>
            )}
            <div className="flex-1 bg-cream dark:bg-night rounded-xl p-3 text-center">
              <p className="text-xs text-ink/50 dark:text-night-muted mb-1">Записів</p>
              <p className="text-lg font-heading font-bold text-ink dark:text-night-ink">{logs.length}</p>
            </div>
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <div className="mb-4 bg-cream dark:bg-night rounded-2xl p-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                min="20"
                max="300"
                value={inputWeight}
                onChange={(e) => setInputWeight(e.target.value)}
                placeholder="Вага, кг (напр. 68.5)"
                className={`flex-1 ${INPUT_CLASS}`}
              />
              <button
                onClick={() => { void handleSave(); }}
                disabled={saving || !inputWeight}
                className="px-4 py-2.5 text-sm font-semibold bg-terracotta hover:bg-terracotta-dark text-card rounded-2xl shadow-soft active:scale-95 transition-all disabled:opacity-50"
              >
                {saving ? '…' : 'Зберегти'}
              </button>
            </div>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Нотатка (необов'язково)"
              className={`w-full ${INPUT_CLASS}`}
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-ink/10 dark:bg-night-ink/10 rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && logs.length === 0 && (
          <div className="text-center py-8 text-ink/50 dark:text-night-muted">
            <p className="text-3xl mb-2">⚖️</p>
            <p className="text-sm">Додайте першу позначку ваги<br />і відстежуйте прогрес</p>
            <p className="text-xs mt-2 text-ink/40 dark:text-night-muted">Рекомендується: 1 раз на тиждень, вранці</p>
          </div>
        )}

        {/* Log list (accordion) */}
        {!loading && logs.length > 0 && (
          <div>
            <button
              onClick={() => setShowHistory((v) => !v)}
              aria-expanded={showHistory}
              className="w-full flex items-center justify-between px-4 py-3 bg-cream dark:bg-night rounded-xl text-sm font-semibold text-ink dark:text-night-ink"
            >
              <span>Історія зважувань ({logs.length})</span>
              <ChevronDown
                size={18}
                className={`text-ink/40 dark:text-night-muted transition-transform ${showHistory ? 'rotate-180' : ''}`}
              />
            </button>

            {showHistory && (
              <div className="space-y-2 mt-2">
                {[...logs].reverse().slice(0, 20).map((log: WeightLog, i) => {
                  const prev = [...logs].reverse()[i + 1];
                  const delta = prev ? Math.round((log.weight - prev.weight) * 10) / 10 : null;
                  const dColor = delta === null
                    ? ''
                    : delta < 0
                    ? 'text-sage-dark dark:text-sage-light'
                    : delta > 0
                    ? 'text-terracotta'
                    : 'text-ink/60 dark:text-night-muted';

                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-cream dark:bg-night rounded-xl px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink dark:text-night-ink">
                          {log.weight} кг
                        </p>
                        {log.note && (
                          <p className="text-xs text-ink/50 dark:text-night-muted">{log.note}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-ink/50 dark:text-night-muted">{formatDate(log.date)}</p>
                        {delta !== null && (
                          <p className={`text-xs font-semibold ${dColor}`}>
                            {delta > 0 ? '+' : ''}{delta} кг
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {logs.length > 20 && (
                  <p className="text-center text-xs text-ink/50 dark:text-night-muted pt-1">
                    Показано останні 20 із {logs.length}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </section>
  );
}
