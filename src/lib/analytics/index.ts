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

type PostHogClient = (typeof import('posthog-js'))['default'];

interface PosthogCaptureOptions {
  timestamp?: Date;
  transport?: 'sendBeacon';
  send_instantly?: boolean;
}

type QueuedCall =
  | {
      kind: 'capture';
      event: string;
      properties: Record<string, unknown>;
      options?: PosthogCaptureOptions;
    }
  | { kind: 'identify'; email: string }
  | { kind: 'reset' };

// posthog-js (~60 КБ gzip) вантажиться лінивим import() — не потрапляє у First
// Load JS жодної сторінки. Виклики до завантаження модуля стають у чергу ЗІ
// СВОЇМ timestamp (реальний час події) і флашаться одразу після init, тож
// порядок і таймлайн подій у PostHog не спотворюються. gtag-гілка лишається
// синхронною: стаб із чергою в dataLayer — стандартний async-паттерн GA.
let posthogClient: PostHogClient | null = null;
let posthogLoadStarted = false;
const pendingCalls: QueuedCall[] = [];

function flushPending(client: PostHogClient): void {
  for (const call of pendingCalls) {
    if (call.kind === 'capture') {
      client.capture(call.event, call.properties, call.options);
    } else if (call.kind === 'identify') {
      client.identify(call.email);
    } else {
      client.reset();
    }
  }
  pendingCalls.length = 0;
}

function ensurePosthog(): void {
  if (posthogLoadStarted) return;
  posthogLoadStarted = true;
  import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
        autocapture: false,
        capture_pageview: false,
        disable_session_recording: true,
        person_profiles: 'always',
      });
      posthogClient = posthog;
      flushPending(posthog);
    })
    .catch(() => {
      // Чанк не завантажився (offline/блокувальник) — дозволяємо повторну
      // спробу наступним викликом; черга лишається в пам'яті.
      posthogLoadStarted = false;
    });
}

function phCapture(
  event: string,
  properties: Record<string, unknown>,
  options?: PosthogCaptureOptions,
): void {
  ensurePosthog();
  if (posthogClient) {
    posthogClient.capture(event, properties, options);
    return;
  }
  pendingCalls.push({
    kind: 'capture',
    event,
    properties,
    options: { ...options, timestamp: options?.timestamp ?? new Date() },
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

  const properties: Record<string, unknown> = { ...enriched };
  if (options.insertId) properties.$insert_id = options.insertId;

  const captureOptions: PosthogCaptureOptions = {};
  if (options.timestamp) captureOptions.timestamp = options.timestamp;
  if (options.beacon) {
    captureOptions.transport = 'sendBeacon';
    captureOptions.send_instantly = true;
  }
  phCapture(
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
  phIdentify(email);
  ensureGtag()?.('set', { user_id: hashEmailForGa4(email) });
}

function phIdentify(email: string): void {
  ensurePosthog();
  if (posthogClient) posthogClient.identify(email);
  else pendingCalls.push({ kind: 'identify', email });
}

export function resetIdentity(): void {
  if (typeof window === 'undefined' || !isAnalyticsEnabled()) return;
  ensurePosthog();
  if (posthogClient) posthogClient.reset();
  else pendingCalls.push({ kind: 'reset' });
}

export function capturePageview(path: string, props: EventProps = {}): void {
  if (typeof window === 'undefined' || !isAnalyticsEnabled()) return;
  phCapture('$pageview', {
    $current_url: path,
    ...props,
    env: getAnalyticsEnv(),
  });
}
