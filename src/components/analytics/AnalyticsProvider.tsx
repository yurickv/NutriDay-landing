'use client';

import React, { Suspense, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Script from 'next/script';
import posthog from 'posthog-js';
import { capturePageview } from '@/lib/analytics';
import { captureAttribution } from '@/lib/analytics/attribution';
import { isAnalyticsEnabled } from '@/lib/analytics/env';

let posthogInitialized = false;

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
    if (posthogInitialized || !isAnalyticsEnabled()) return;
    posthogInitialized = true;
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      person_profiles: 'always',
    });
    try {
      captureAttribution(window.location.search, window.localStorage);
    } catch {
      // localStorage unavailable — ignore
    }
  }, []);

  return (
    <>
      {gaId && isAnalyticsEnabled() && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
gtag('config', '${gaId}', { send_page_view: false });`}
          </Script>
        </>
      )}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  );
}
