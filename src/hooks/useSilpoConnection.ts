'use client';

import { useCallback, useEffect, useState } from 'react';
import { track } from '@/lib/analytics';

export interface SilpoStatus {
  enabled: boolean;
  connected: boolean;
  status: 'active' | 'expired' | null;
  cart: { city: string | null; street: string | null; deliveryType: string } | null;
}

/** Reads `?silpo=connected|error` once (set by the OAuth callback) and strips it from the URL. */
function readFlash(): 'connected' | 'error' | null {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const value = url.searchParams.get('silpo');
  if (value !== 'connected' && value !== 'error') return null;
  url.searchParams.delete('silpo');
  window.history.replaceState({}, '', url.toString());
  return value;
}

export function useSilpoConnection() {
  const [data, setData] = useState<SilpoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<'connected' | 'error' | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/silpo/status');
      if (res.ok) setData((await res.json()) as SilpoStatus);
    } catch {
      // keep previous state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const f = readFlash();
    if (f) {
      setFlash(f);
      if (f === 'connected') track('silpo_connected');
    }
    void refresh();
  }, [refresh]);

  const disconnect = useCallback(async () => {
    const res = await fetch('/api/silpo/connection', { method: 'DELETE' });
    if (res.ok) {
      track('silpo_disconnected');
      setData((prev) => (prev ? { ...prev, connected: false, status: null, cart: null } : prev));
    }
  }, []);

  const connectHref = useCallback(
    (returnTo: string) => `/api/silpo/connect?returnTo=${encodeURIComponent(returnTo)}`,
    [],
  );

  return { data, loading, refresh, disconnect, connectHref, flash };
}
