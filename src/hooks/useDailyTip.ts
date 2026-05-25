'use client';

import { useState, useEffect } from 'react';
import { Tip } from '@/types/engagement';

export function useDailyTip(context?: Tip['category']) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cacheKey = `nd_tip_${context ?? 'all'}_${new Date().toISOString().slice(0, 10)}`;

    // Check sessionStorage cache
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        setTip(JSON.parse(cached) as Tip);
        setLoading(false);
        return;
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }

    const url = context ? `/api/tips?context=${context}` : '/api/tips';
    fetch(url)
      .then((res) => res.ok ? res.json() as Promise<{ tip: Tip | null }> : Promise.resolve({ tip: null }))
      .then(({ tip: t }) => {
        setTip(t);
        if (t) sessionStorage.setItem(cacheKey, JSON.stringify(t));
      })
      .catch(() => setTip(null))
      .finally(() => setLoading(false));
  }, [context]);

  return { tip, loading };
}
