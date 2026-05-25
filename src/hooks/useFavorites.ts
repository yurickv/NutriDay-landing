'use client';

import { useState, useEffect, useCallback } from 'react';
import { FavoriteMeal } from '@/types/engagement';
import { AIMeal } from '@/types/meals';

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteMeal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFavorites = useCallback(async () => {
    try {
      const res = await fetch('/api/favorites');
      if (res.ok) {
        const data = await res.json() as { favorites: FavoriteMeal[] };
        setFavorites(data.favorites);
      }
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFavorites();
  }, [fetchFavorites]);

  const saveFavorite = useCallback(async (meal: AIMeal): Promise<boolean> => {
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal }),
      });
      if (res.ok) {
        await fetchFavorites();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [fetchFavorites]);

  const removeFavorite = useCallback(async (id: string): Promise<boolean> => {
    // Optimistic
    setFavorites((prev) => prev.filter((f) => f._id !== id));
    try {
      const res = await fetch(`/api/favorites?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        await fetchFavorites(); // rollback
        return false;
      }
      return true;
    } catch {
      await fetchFavorites();
      return false;
    }
  }, [fetchFavorites]);

  const isFavorite = useCallback((mealName: string) => {
    return favorites.some((f) => f.meal.name === mealName);
  }, [favorites]);

  return { favorites, loading, saveFavorite, removeFavorite, isFavorite, refetch: fetchFavorites };
}
