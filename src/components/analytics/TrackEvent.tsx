'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/lib/analytics';
import type { AnalyticsEvent } from '@/lib/analytics';
import { readAttribution } from '@/lib/analytics/attribution';

export function TrackEvent({
  event,
  withUtmSource = false,
}: {
  event: AnalyticsEvent;
  withUtmSource?: boolean;
}) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const props = withUtmSource
      ? { utm_source: readAttribution(window.localStorage).utmSource }
      : {};
    track(event, props);
  }, [event, withUtmSource]);
  return null;
}
