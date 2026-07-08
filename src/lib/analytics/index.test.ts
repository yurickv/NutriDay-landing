import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const posthogMock = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('posthog-js', () => ({ default: posthogMock }));

interface GtagWindow {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
}

function getWindow(): GtagWindow {
  return window as unknown as GtagWindow;
}

function dataLayerCalls(): unknown[][] {
  return (getWindow().dataLayer ?? []).map((entry) =>
    Array.from(entry as ArrayLike<unknown>),
  );
}

// The facade keeps module-level init state, so each test re-imports a fresh copy.
async function loadFacade() {
  vi.resetModules();
  return import('./index');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://eu.i.posthog.com');
  vi.stubEnv('NEXT_PUBLIC_GA_ID', 'G-TEST');
  vi.stubEnv('NEXT_PUBLIC_ANALYTICS_ENV', 'staging');
  vi.stubGlobal('window', {} as GtagWindow);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('track PostHog init race', () => {
  it('initializes posthog before the first capture', async () => {
    const { track } = await loadFacade();
    track('water_logged', { amount: 250 });

    expect(posthogMock.init).toHaveBeenCalledTimes(1);
    expect(posthogMock.capture).toHaveBeenCalledTimes(1);
    expect(posthogMock.init.mock.invocationCallOrder[0]).toBeLessThan(
      posthogMock.capture.mock.invocationCallOrder[0],
    );
  });

  it('initializes posthog only once across multiple calls', async () => {
    const { track, identify, capturePageview } = await loadFacade();
    track('water_logged');
    identify('a@b.com');
    capturePageview('/menu');

    expect(posthogMock.init).toHaveBeenCalledTimes(1);
  });

  it('passes key and host from env to init', async () => {
    const { track } = await loadFacade();
    track('water_logged');

    expect(posthogMock.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ api_host: 'https://eu.i.posthog.com' }),
    );
  });

  it('initializes posthog before identify even without a prior track', async () => {
    const { identify } = await loadFacade();
    identify('a@b.com');

    expect(posthogMock.init).toHaveBeenCalledTimes(1);
    expect(posthogMock.identify).toHaveBeenCalledWith('a@b.com');
    expect(posthogMock.init.mock.invocationCallOrder[0]).toBeLessThan(
      posthogMock.identify.mock.invocationCallOrder[0],
    );
  });

  it('does nothing when analytics is disabled (no posthog key)', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '');
    const { track } = await loadFacade();
    track('water_logged');

    expect(posthogMock.init).not.toHaveBeenCalled();
    expect(posthogMock.capture).not.toHaveBeenCalled();
    expect(getWindow().gtag).toBeUndefined();
  });
});

describe('track GA4 queueing before gtag.js loads', () => {
  it('creates a gtag stub that queues js + config before the first event', async () => {
    const { track } = await loadFacade();
    track('water_logged', { amount: 250 });

    const calls = dataLayerCalls();
    expect(calls[0]?.[0]).toBe('js');
    expect(calls[1]).toEqual(['config', 'G-TEST', { send_page_view: false }]);
    expect(calls[2]?.[0]).toBe('event');
    expect(calls[2]?.[1]).toBe('water_logged');
  });

  it('does not re-run config when gtag already exists', async () => {
    const { track } = await loadFacade();
    track('water_logged');
    track('weight_logged');

    const configCalls = dataLayerCalls().filter((c) => c[0] === 'config');
    expect(configCalls).toHaveLength(1);
  });

  it('initAnalytics prepares posthog and the gtag queue without emitting events', async () => {
    const { initAnalytics } = await loadFacade();
    initAnalytics();

    expect(posthogMock.init).toHaveBeenCalledTimes(1);
    expect(posthogMock.capture).not.toHaveBeenCalled();
    const calls = dataLayerCalls();
    expect(calls.map((c) => c[0])).toEqual(['js', 'config']);
  });
});

describe('track beacon option for pre-navigation events', () => {
  it('sends via sendBeacon instantly when beacon is set', async () => {
    const { track } = await loadFacade();
    track('redirected_to_liqpay', { plan: 'week' }, { beacon: true });

    expect(posthogMock.capture).toHaveBeenCalledWith(
      'redirected_to_liqpay',
      expect.objectContaining({ plan: 'week' }),
      expect.objectContaining({ transport: 'sendBeacon', send_instantly: true }),
    );
    const event = dataLayerCalls().find((c) => c[0] === 'event');
    expect(event?.[2]).toMatchObject({ transport_type: 'beacon' });
  });

  it('keeps insertId and timestamp behavior alongside beacon', async () => {
    const { track } = await loadFacade();
    const ts = new Date(1719700000000);
    track(
      'payment_succeeded',
      { orderId: 'ND-week-1719700000000' },
      { insertId: 'pay_success:ND-week-1719700000000', timestamp: ts, beacon: true },
    );

    expect(posthogMock.capture).toHaveBeenCalledWith(
      'payment_succeeded',
      expect.objectContaining({ $insert_id: 'pay_success:ND-week-1719700000000' }),
      expect.objectContaining({ timestamp: ts, transport: 'sendBeacon' }),
    );
  });
});
