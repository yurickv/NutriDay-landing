'use client';

import React, { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import { capturePageview, initAnalytics } from '@/lib/analytics';
import { captureAttribution } from '@/lib/analytics/attribution';
import { isAnalyticsEnabled } from '@/lib/analytics/env';

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isAnalyticsEnabled()) return;
    const qs = searchParams?.toString();
    const path = qs ? `${pathname}?${qs}` : pathname || '/';
    capturePageview(path);
  }, [pathname, searchParams]);

  return null;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  useEffect(() => {
    // The facade self-initializes on first use (child effects run before this
    // one); this call covers pages that emit no events of their own.
    initAnalytics();
    if (!isAnalyticsEnabled()) return;
    try {
      captureAttribution(window.location.search, window.localStorage);
    } catch {
      // localStorage unavailable — ignore
    }
  }, []);

  return (
    <>
      {gaId && isAnalyticsEnabled() && (
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
          strategy="afterInteractive"
        />
      )}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  );
}
