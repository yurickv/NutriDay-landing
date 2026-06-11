'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Chrome/Android fires this before showing the native install prompt.
 * It is not in the standard lib.dom types, so we describe it locally.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable';

/**
 * Centralises PWA install state for the whole app.
 *
 * Detection of "is it already installed?" relies on three signals:
 *  - display-mode: standalone media query (Android/desktop launched from home screen)
 *  - navigator.standalone (iOS Safari, when launched from home screen)
 *  - the `appinstalled` event (fires the moment the user accepts the prompt)
 *
 * On Android/Chrome we capture `beforeinstallprompt` so we can trigger the
 * native install dialog on demand. iOS has no programmatic install, so callers
 * fall back to manual instructions when `isIOS` is true and `canPrompt` is false.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [appInstalled, setAppInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iphone|ipad|ipod/i.test(ua));

    const standaloneMq = window.matchMedia('(display-mode: standalone)');
    const computeStandalone = () =>
      standaloneMq.matches ||
      // iOS Safari exposes this non-standard flag when launched from home screen
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    setIsStandalone(computeStandalone());

    const handleBeforeInstall = (e: Event) => {
      // Prevent the mini-infobar; we surface our own UI instead.
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setAppInstalled(true);
      setDeferredPrompt(null);
    };
    const handleDisplayModeChange = () => setIsStandalone(computeStandalone());

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    standaloneMq.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
      standaloneMq.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<InstallOutcome> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // A used prompt cannot be reused — drop it regardless of the outcome.
    setDeferredPrompt(null);
    return outcome;
  }, [deferredPrompt]);

  return {
    /** App is running as an installed PWA (or was just installed this session). */
    isInstalled: isStandalone || appInstalled,
    /** Device is iOS — install must be done manually via the Share menu. */
    isIOS,
    /** A native install prompt is ready (Android/Chrome). */
    canPrompt: deferredPrompt !== null,
    /** Triggers the native install dialog; returns the user's choice. */
    promptInstall,
  };
}
