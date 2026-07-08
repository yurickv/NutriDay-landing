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
  /**
   * Sends the event immediately via sendBeacon (skipping the batch queue) so it
   * survives a full-page navigation right after the call — e.g. the redirect to
   * LiqPay via form.submit().
   */
  beacon?: boolean;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// React runs child effects before parent effects, so events fired from page
// components on the first load would reach posthog/gtag before the provider's
// init effect. Both ensure* helpers below make every facade entry point
// self-initializing instead of relying on effect ordering.
let posthogInitialized = false;

function ensurePosthog(): void {
  if (posthogInitialized) return;
  posthogInitialized = true;
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
    autocapture: false,
    capture_pageview: false,
    disable_session_recording: true,
    person_profiles: 'always',
  });
}

// Standard async-gtag pattern: create the stub + queue `js`/`config` into
// dataLayer up front; gtag.js replays the queue in order once it loads, so
// events pushed before the script arrives are not lost.
function ensureGtag(): Window['gtag'] {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId) return undefined;
  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag('js', new Date());
    window.gtag('config', gaId, { send_page_view: false });
  }
  return window.gtag;
}

/**
 * Idempotent bootstrap for both sinks. Safe to call from anywhere on the
 * client; the AnalyticsProvider calls it on mount so pages without early
 * events still get initialized.
 */
export function initAnalytics(): void {
  if (typeof window === 'undefined' || !isAnalyticsEnabled()) return;
  ensurePosthog();
  ensureGtag();
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
  ensurePosthog();

  const properties: Record<string, unknown> = { ...enriched };
  if (options.insertId) properties.$insert_id = options.insertId;

  const captureOptions: {
    timestamp?: Date;
    transport?: 'sendBeacon';
    send_instantly?: boolean;
  } = {};
  if (options.timestamp) captureOptions.timestamp = options.timestamp;
  if (options.beacon) {
    captureOptions.transport = 'sendBeacon';
    captureOptions.send_instantly = true;
  }
  posthog.capture(
    event,
    properties,
    Object.keys(captureOptions).length ? captureOptions : undefined,
  );

  const ga = toGa4Event(event, enriched);
  const gaParams = options.beacon
    ? { ...ga.params, transport_type: 'beacon' }
    : ga.params;
  ensureGtag()?.('event', ga.name, gaParams);
}

export function identify(email: string): void {
  if (typeof window === 'undefined' || !isAnalyticsEnabled()) return;
  ensurePosthog();
  posthog.identify(email);
  ensureGtag()?.('set', { user_id: hashEmailForGa4(email) });
}

export function resetIdentity(): void {
  if (typeof window === 'undefined' || !isAnalyticsEnabled()) return;
  ensurePosthog();
  posthog.reset();
}

export function capturePageview(path: string, props: EventProps = {}): void {
  if (typeof window === 'undefined' || !isAnalyticsEnabled()) return;
  ensurePosthog();
  posthog.capture('$pageview', { $current_url: path, ...props, env: getAnalyticsEnv() });
  ensureGtag()?.('event', 'page_view', { page_path: path });
}
