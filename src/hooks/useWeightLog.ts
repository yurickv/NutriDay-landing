'use client';

import { useState, useEffect, useCallback } from 'react';
import { WeightLog } from '@/types/engagement';

export function useWeightLog() {
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/weight');
      if (res.ok) {
        const data = await res.json() as { logs: WeightLog[] };
        setLogs(data.logs);
      }
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const addWeight = useCallback(async (weight: number, note?: string): Promise<boolean> => {
    setSaving(true);
    try {
      const res = await fetch('/api/weight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight, note }),
      });
      if (res.ok) {
        await fetchLogs();
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, [fetchLogs]);

  // Computed: last entry and week-over-week delta
  const lastWeight = logs[logs.length - 1]?.weight ?? null;
  const firstWeight = logs[0]?.weight ?? null;
  const totalDelta = lastWeight !== null && firstWeight !== null
    ? Math.round((lastWeight - firstWeight) * 10) / 10
    : null;

  return { logs, loading, saving, addWeight, lastWeight, totalDelta, refetch: fetchLogs };
}
