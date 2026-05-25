'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserStreak } from '@/types/engagement';

export function useStreak() {
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStreak = useCallback(async () => {
    try {
      const res = await fetch('/api/streak');
      if (res.ok) {
        const data = await res.json() as UserStreak;
        setStreak(data);
      }
    } catch {
      // silently fail — streak is non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStreak();
  }, [fetchStreak]);

  return { streak, loading, refetch: fetchStreak };
}
