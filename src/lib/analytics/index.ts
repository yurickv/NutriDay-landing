import posthog from 'posthog-js';
import type { AnalyticsEvent } from './events';
import { toGa4Event, hashEmailForGa4 } from './ga4';
import { getAnalyticsEnv, isAnalyticsEnabled } from './env';

export type { AnalyticsEvent } from './events';

export type EventProps = Record<string, string | number | boolean | undefined>;

export interface TrackOptions {
  /** Sets PostHog `$insert_id` for deduplication. */
  insertId?: string;
  /** Overrides the event timestamp (used with insertId for deterministic dedup). */
  timestamp?: Date;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(
  event: AnalyticsEvent,
  props: EventProps = {},
  options: TrackOptions = {},
): void {
  if (typeof window === 'undefined') return;

  const enriched: EventProps = { ...props, env: getAnalyticsEnv() };

  if (process.env.NODE_ENV === 'development') {
    console.debug('[analytics]', event, enriched, options);
  }
  if (!isAnalyticsEnabled()) return;

  const properties: Record<string, unknown> = { ...enriched };
  if (options.insertId) properties.$insert_id = options.insertId;
  posthog.capture(event, properties, options.timestamp ? { timestamp: options.timestamp } : undefined);

  const ga = toGa4Event(event, enriched);
  window.gtag?.('event', ga.name, ga.params);
}

export function identify(email: string): void {
  if (typeof window === 'undefined' || !isAnalyticsEnabled()) return;
  posthog.identify(email);
  window.gtag?.('set', { user_id: hashEmailForGa4(email) });
}

export function resetIdentity(): void {
  if (typeof window === 'undefined' || !isAnalyticsEnabled()) return;
  posthog.reset();
}

export function capturePageview(path: string, props: EventProps = {}): void {
  if (typeof window === 'undefined' || !isAnalyticsEnabled()) return;
  posthog.capture('$pageview', { $current_url: path, ...props, env: getAnalyticsEnv() });
  window.gtag?.('event', 'page_view', { page_path: path });
}
