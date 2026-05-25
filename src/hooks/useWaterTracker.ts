'use client';

import { useState, useEffect, useCallback } from 'react';
import { WaterLog } from '@/types/engagement';

export function useWaterTracker() {
  const [water, setWater] = useState<WaterLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const fetchWater = useCallback(async () => {
    try {
      const res = await fetch('/api/water');
      if (res.ok) {
        const data = await res.json() as WaterLog;
        setWater(data);
      }
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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
        const queue = JSON.parse(localStorage.getItem('nd_water_queue') ?? '[]') as number[];
        queue.push(amountMl);
        localStorage.setItem('nd_water_queue', JSON.stringify(queue));
        return;
      }

      const res = await fetch('/api/water', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountMl }),
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
      const queue = JSON.parse(raw) as number[];
      if (!queue.length) return;
      localStorage.removeItem('nd_water_queue');

      for (const amount of queue) {
        await fetch('/api/water', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amountMl: amount }),
        });
      }
      await fetchWater();
    };

    window.addEventListener('online', () => { void syncQueue(); });
    return () => window.removeEventListener('online', () => { void syncQueue(); });
  }, [fetchWater]);

  return { water, loading, adding, addWater, refetch: fetchWater };
}
