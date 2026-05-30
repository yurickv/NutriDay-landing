'use client';

import { useState, useEffect, useCallback } from 'react';
import { WaterLog } from '@/types/engagement';

export function useWaterTracker(date?: string) {
  const [water, setWater] = useState<WaterLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const fetchWater = useCallback(async () => {
    try {
      const url = date ? `/api/water?date=${date}` : '/api/water';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as WaterLog;
        setWater(data);
      }
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    setLoading(true);
    void fetchWater();
  }, [fetchWater]);

  const addWater = useCallback(async (amountMl: number) => {
    if (adding) return;
    setAdding(true);

    // Optimistic update
    setWater((prev) => {
      if (!prev) return prev;
      return { ...prev, amountMl: prev.amountMl + amountMl };
    });

    try {
      // localStorage offline fallback
      if (!navigator.onLine) {
        const queue = JSON.parse(localStorage.getItem('nd_water_queue') ?? '[]') as { amountMl: number; date?: string }[];
        queue.push({ amountMl, date });
        localStorage.setItem('nd_water_queue', JSON.stringify(queue));
        return;
      }

      const res = await fetch('/api/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountMl, date }),
      });

      if (res.ok) {
        const data = await res.json() as { amountMl: number; goalMl: number };
        setWater((prev) => prev ? { ...prev, amountMl: data.amountMl, goalMl: data.goalMl } : prev);
      } else {
        // Rollback on failure
        setWater((prev) => prev ? { ...prev, amountMl: prev.amountMl - amountMl } : prev);
      }
    } catch {
      setWater((prev) => prev ? { ...prev, amountMl: prev.amountMl - amountMl } : prev);
    } finally {
      setAdding(false);
    }
  }, [adding]);

  // Sync offline queue when back online
  useEffect(() => {
    const syncQueue = async () => {
      const raw = localStorage.getItem('nd_water_queue');
      if (!raw) return;
      // Support both the legacy number[] format and the current {amountMl, date}[] format.
      const queue = JSON.parse(raw) as (number | { amountMl: number; date?: string })[];
      if (!queue.length) return;
      localStorage.removeItem('nd_water_queue');

      for (const item of queue) {
        const payload = typeof item === 'number' ? { amountMl: item } : item;
        await fetch('/api/water', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      await fetchWater();
    };

    window.addEventListener('online', () => { void syncQueue(); });
    return () => window.removeEventListener('online', () => { void syncQueue(); });
  }, [fetchWater]);

  return { water, loading, adding, addWater, refetch: fetchWater };
}
