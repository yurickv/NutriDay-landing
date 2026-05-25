'use client';

import { useState, useEffect, useCallback } from 'react';

type PermissionState = 'default' | 'granted' | 'denied';

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supported = 'PushManager' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);
    if (!supported) return;

    setPermission(Notification.permission as PermissionState);

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setIsSubscribed(!!sub);
      });
    });
  }, []);

  const subscribe = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      setPermission(permission as PermissionState);

      if (permission !== 'granted') {
        setError('Дозвіл на сповіщення відхилено');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error('VAPID key not configured');

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });

      if (!res.ok) throw new Error('Failed to save subscription');
      setIsSubscribed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка підписки');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { setIsSubscribed(false); return; }

      await sub.unsubscribe();
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      setIsSubscribed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Помилка відписки');
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isSupported, isSubscribed, permission, isLoading, error, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
