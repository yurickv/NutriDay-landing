# Analytics Funnel Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PostHog + GA4 funnel tracking and UTM source attribution to NutriDay so we can see, per traffic source (Instagram vs partner), how users move landing → onboarding → payment → login and exactly where they drop off before paying.

**Architecture:** A single client-side `track()` facade fans out every event to both PostHog (`posthog-js`) and GA4 (`gtag`). Pure logic (GA4 event mapping, email hashing, UTM parse/persist, order-id parsing/dedup, env resolution) lives in small, unit-tested helper modules under `src/lib/analytics/`. Page/route touchpoints call the facade. The authoritative payment events are also captured server-side from the LiqPay callback via `posthog-node`, deduplicated against the client event using a deterministic `$insert_id` + timestamp derived from `orderId`.

**Tech Stack:** Next.js 15 (App Router, Turbopack), React 19, TypeScript 5, `posthog-js`, `posthog-node`, `js-sha256`, GA4 (gtag.js via `next/script`), Vitest (pure-logic unit tests only).

## Global Constraints

- **Next.js 15 App Router / React 19 / TypeScript 5** — match existing code style.
- **PostHog host:** `https://eu.posthog.com` (EU region). PostHog init flags are fixed: `autocapture: false`, `capture_pageview: false`, `disable_session_recording: true`, `person_profiles: 'always'`. Do NOT use `identified_only`.
- **distinct_id = email.** PostHog gets the **clean** email; GA4 gets **only** `sha256(email.trim().toLowerCase())` as `user_id`. **Never send raw email to GA4** (Google PII policy).
- **Every event carries an `env` prop** with value `local | staging | prod`.
- **Three environments:** `local` = no `NEXT_PUBLIC_POSTHOG_KEY` → `track()` console-only, zero network. `staging`/`prod` = key present, label from `NEXT_PUBLIC_ANALYTICS_ENV`.
- **Testing:** Vitest covers pure logic only. Everything else is verified with `npx tsc --noEmit` and a manual staging *Live Events* checklist. Tests run in the Node environment.
- **Repo gotcha:** never run `next build` while `next dev` is running (it 500s the dev server). Type-check with `npx tsc --noEmit`.
- **UTM convention** (team must tag all links): Instagram bio `utm_source=instagram&utm_medium=social&utm_campaign=bio`; Instagram stories `…&utm_campaign=stories`; partner `utm_source=partner&utm_medium=referral&utm_campaign=<name>`.

---

## File Structure

**New files:**
- `src/lib/analytics/env.ts` — env resolution (`resolveAnalyticsEnv`, `getAnalyticsEnv`, `isAnalyticsEnabled`).
- `src/lib/analytics/ga4.ts` — GA4 event-name mapping (`toGa4Event`) + email hashing (`hashEmailForGa4`).
- `src/lib/analytics/attribution.ts` — UTM parse + first-touch localStorage persist (`parseUtm`, `captureAttribution`, `readAttribution`, `Attribution`).
- `src/lib/analytics/payment.ts` — order-id parsing + dedup insert-ids (`parseOrderId`, `paymentSuccessInsertId`, `paymentFailedInsertId`).
- `src/lib/analytics/events.ts` — `AnalyticsEvent` union type.
- `src/lib/analytics/index.ts` — the client facade (`track`, `identify`, `resetIdentity`, `capturePageview`); **replaces** `src/lib/analytics.ts`.
- `src/lib/analytics/posthog.server.ts` — server capture (`buildPaymentCaptureArgs`, `capturePaymentEvent`).
- `src/components/analytics/AnalyticsProvider.tsx` — initializes PostHog + GA4, manual pageviews, first-touch attribution capture.
- `src/components/analytics/TrackEvent.tsx` — fire-once-on-mount client helper.
- `vitest.config.ts` — Vitest config.
- `.env.example` — document analytics env vars (create or append).
- Co-located `*.test.ts` files next to each pure-logic helper.

**Modified files:**
- `src/app/layout.tsx` — mount `AnalyticsProvider`.
- `src/app/onboarding/page.tsx` — `onboarding_started`.
- `src/app/onboarding/creating-plan/page.tsx` — `onboarding_completed`.
- `src/app/payment/plan/page.tsx` — payment-page funnel events + `identify` + `ph-no-capture` + pass UTM to init.
- `src/app/payment/result/page.tsx` — client `payment_succeeded`/`payment_failed` + re-identify.
- `src/app/auth/confirm/page.tsx` — `login_completed` + `identify`.
- `src/app/api/subscription/init/route.ts` — store UTM on `users`.
- `src/app/api/liqpay/callback/route.ts` — server payment events.
- `src/app/api/auth/magic-link/consume/route.ts` — server payment event on reconciliation + return `email`.
- `package.json` — deps + `test` script.

**Deleted files:**
- `src/lib/analytics.ts` (moved to `src/lib/analytics/index.ts`).

---

# PHASE 1 — Client funnel (full funnel, including client-side payment_succeeded)

## Task 1: Dependencies, Vitest, and env helper

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `src/lib/analytics/env.ts`
- Test: `src/lib/analytics/env.test.ts`

**Interfaces:**
- Produces: `resolveAnalyticsEnv({ posthogKey?, envLabel? }): 'local'|'staging'|'prod'`; `getAnalyticsEnv(): AnalyticsEnv`; `isAnalyticsEnabled(): boolean`; type `AnalyticsEnv`.

- [ ] **Step 1: Install dependencies**

```bash
npm install posthog-js posthog-node js-sha256
npm install -D vitest
```

- [ ] **Step 2: Add the test script to `package.json`**

In the `"scripts"` block, add:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create `.env.example` (or append these lines if it exists)**

```bash
# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
NEXT_PUBLIC_GA_ID=
# local (unset key) | staging | prod
NEXT_PUBLIC_ANALYTICS_ENV=
# Server-side capture (same project key as NEXT_PUBLIC_POSTHOG_KEY)
POSTHOG_API_KEY=
```

- [ ] **Step 5: Write the failing test** — `src/lib/analytics/env.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { resolveAnalyticsEnv } from './env';

describe('resolveAnalyticsEnv', () => {
  it('returns local when no posthog key', () => {
    expect(resolveAnalyticsEnv({ posthogKey: undefined, envLabel: 'prod' })).toBe('local');
  });
  it('returns staging when key present and label is staging', () => {
    expect(resolveAnalyticsEnv({ posthogKey: 'phc_x', envLabel: 'staging' })).toBe('staging');
  });
  it('returns prod when key present and label is prod', () => {
    expect(resolveAnalyticsEnv({ posthogKey: 'phc_x', envLabel: 'prod' })).toBe('prod');
  });
  it('defaults to prod when key present but label missing', () => {
    expect(resolveAnalyticsEnv({ posthogKey: 'phc_x', envLabel: undefined })).toBe('prod');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./env`.

- [ ] **Step 7: Create `src/lib/analytics/env.ts`**

```ts
export type AnalyticsEnv = 'local' | 'staging' | 'prod';

export function resolveAnalyticsEnv(input: {
  posthogKey?: string;
  envLabel?: string;
}): AnalyticsEnv {
  if (!input.posthogKey) return 'local';
  return input.envLabel === 'staging' ? 'staging' : 'prod';
}

export function getAnalyticsEnv(): AnalyticsEnv {
  return resolveAnalyticsEnv({
    posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    envLabel: process.env.NEXT_PUBLIC_ANALYTICS_ENV,
  });
}

export function isAnalyticsEnabled(): boolean {
  return getAnalyticsEnv() !== 'local';
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts .env.example src/lib/analytics/env.ts src/lib/analytics/env.test.ts
git commit -m "feat(analytics): add deps, vitest, and env resolution helper"
```

---

## Task 2: GA4 mapping + email hash helpers

**Files:**
- Create: `src/lib/analytics/ga4.ts`
- Test: `src/lib/analytics/ga4.test.ts`

**Interfaces:**
- Consumes: `js-sha256` (`sha256`).
- Produces: `toGa4Event(event: string, props?: Record<string, unknown>): { name: string; params: Record<string, unknown> }`; `hashEmailForGa4(email: string): string`.

- [ ] **Step 1: Write the failing test** — `src/lib/analytics/ga4.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { sha256 } from 'js-sha256';
import { toGa4Event, hashEmailForGa4 } from './ga4';

describe('toGa4Event', () => {
  it('maps checkout_started to begin_checkout with value/currency', () => {
    expect(toGa4Event('checkout_started', { amount: 99, currency: 'UAH' })).toEqual({
      name: 'begin_checkout',
      params: { value: 99, currency: 'UAH' },
    });
  });
  it('maps payment_succeeded to purchase with transaction_id', () => {
    expect(toGa4Event('payment_succeeded', { amount: 199, currency: 'UAH', orderId: 'ND-month-1' })).toEqual({
      name: 'purchase',
      params: { transaction_id: 'ND-month-1', value: 199, currency: 'UAH' },
    });
  });
  it('passes unknown events through unchanged', () => {
    expect(toGa4Event('onboarding_started', { utm_source: 'instagram' })).toEqual({
      name: 'onboarding_started',
      params: { utm_source: 'instagram' },
    });
  });
  it('defaults currency to UAH', () => {
    expect(toGa4Event('checkout_started', { amount: 50 }).params).toEqual({ value: 50, currency: 'UAH' });
  });
});

describe('hashEmailForGa4', () => {
  it('normalizes case/whitespace then sha256s', () => {
    expect(hashEmailForGa4('  Test@Example.COM ')).toBe(sha256('test@example.com'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./ga4`.

- [ ] **Step 3: Create `src/lib/analytics/ga4.ts`**

```ts
import { sha256 } from 'js-sha256';

export interface Ga4Event {
  name: string;
  params: Record<string, unknown>;
}

export function toGa4Event(
  event: string,
  props: Record<string, unknown> = {},
): Ga4Event {
  switch (event) {
    case 'checkout_started':
      return {
        name: 'begin_checkout',
        params: { value: props.amount, currency: (props.currency as string) ?? 'UAH' },
      };
    case 'payment_succeeded':
      return {
        name: 'purchase',
        params: {
          transaction_id: props.orderId,
          value: props.amount,
          currency: (props.currency as string) ?? 'UAH',
        },
      };
    default:
      return { name: event, params: props };
  }
}

export function hashEmailForGa4(email: string): string {
  return sha256(email.trim().toLowerCase());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS (env + ga4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/ga4.ts src/lib/analytics/ga4.test.ts
git commit -m "feat(analytics): add GA4 event mapping and email hashing"
```

---

## Task 3: UTM attribution helpers

**Files:**
- Create: `src/lib/analytics/attribution.ts`
- Test: `src/lib/analytics/attribution.test.ts`

**Interfaces:**
- Produces: interface `Attribution { utmSource?; utmMedium?; utmCampaign?; utmContent?; utmTerm? }` (all `string`); `parseUtm(search: string): Attribution`; `captureAttribution(search: string, storage: Pick<Storage,'getItem'|'setItem'>): void`; `readAttribution(storage: Pick<Storage,'getItem'>): Attribution`.

- [ ] **Step 1: Write the failing test** — `src/lib/analytics/attribution.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseUtm, captureAttribution, readAttribution } from './attribution';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    _map: map,
  };
}

describe('parseUtm', () => {
  it('extracts utm params', () => {
    expect(parseUtm('?utm_source=instagram&utm_medium=social&utm_campaign=bio')).toEqual({
      utmSource: 'instagram',
      utmMedium: 'social',
      utmCampaign: 'bio',
    });
  });
  it('returns empty object when no utm params', () => {
    expect(parseUtm('?foo=bar')).toEqual({});
  });
});

describe('captureAttribution (first-touch wins)', () => {
  it('writes attribution when storage empty and utm present', () => {
    const s = fakeStorage();
    captureAttribution('?utm_source=partner&utm_medium=referral', s);
    expect(JSON.parse(s.getItem('nd_attribution')!)).toEqual({ utmSource: 'partner', utmMedium: 'referral' });
  });
  it('does NOT overwrite existing attribution', () => {
    const s = fakeStorage({ nd_attribution: JSON.stringify({ utmSource: 'instagram' }) });
    captureAttribution('?utm_source=partner', s);
    expect(JSON.parse(s.getItem('nd_attribution')!)).toEqual({ utmSource: 'instagram' });
  });
  it('does nothing when no utm present', () => {
    const s = fakeStorage();
    captureAttribution('?foo=bar', s);
    expect(s.getItem('nd_attribution')).toBeNull();
  });
});

describe('readAttribution', () => {
  it('parses stored attribution', () => {
    const s = fakeStorage({ nd_attribution: JSON.stringify({ utmSource: 'instagram' }) });
    expect(readAttribution(s)).toEqual({ utmSource: 'instagram' });
  });
  it('returns empty object when nothing stored', () => {
    expect(readAttribution(fakeStorage())).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./attribution`.

- [ ] **Step 3: Create `src/lib/analytics/attribution.ts`**

```ts
export interface Attribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}

const STORAGE_KEY = 'nd_attribution';

const UTM_KEYS: Array<[keyof Attribution, string]> = [
  ['utmSource', 'utm_source'],
  ['utmMedium', 'utm_medium'],
  ['utmCampaign', 'utm_campaign'],
  ['utmContent', 'utm_content'],
  ['utmTerm', 'utm_term'],
];

export function parseUtm(search: string): Attribution {
  const params = new URLSearchParams(search);
  const out: Attribution = {};
  for (const [key, param] of UTM_KEYS) {
    const value = params.get(param);
    if (value) out[key] = value;
  }
  return out;
}

export function captureAttribution(
  search: string,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): void {
  if (storage.getItem(STORAGE_KEY)) return; // first-touch wins
  const parsed = parseUtm(search);
  if (Object.keys(parsed).length === 0) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(parsed));
}

export function readAttribution(storage: Pick<Storage, 'getItem'>): Attribution {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/attribution.ts src/lib/analytics/attribution.test.ts
git commit -m "feat(analytics): add first-touch UTM attribution helpers"
```

---

## Task 4: Order-id parsing + payment dedup helpers

**Files:**
- Create: `src/lib/analytics/payment.ts`
- Test: `src/lib/analytics/payment.test.ts`

**Interfaces:**
- Produces: `parseOrderId(orderId: string): { plan: string | null; ts: number | null }`; `paymentSuccessInsertId(orderId: string): string`; `paymentFailedInsertId(orderId: string): string`.
- Note: `orderId` is created in `payment/plan/page.tsx` as `` `ND-${plan}-${Date.now()}` `` (e.g. `ND-week-1719700000000`). The embedded epoch ms gives a deterministic timestamp shared by the client and server payment events, so they deduplicate.

- [ ] **Step 1: Write the failing test** — `src/lib/analytics/payment.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseOrderId, paymentSuccessInsertId, paymentFailedInsertId } from './payment';

describe('parseOrderId', () => {
  it('parses plan and epoch ms', () => {
    expect(parseOrderId('ND-week-1719700000000')).toEqual({ plan: 'week', ts: 1719700000000 });
  });
  it('parses month plan', () => {
    expect(parseOrderId('ND-month-1719700000001')).toEqual({ plan: 'month', ts: 1719700000001 });
  });
  it('returns nulls for malformed id', () => {
    expect(parseOrderId('garbage')).toEqual({ plan: null, ts: null });
  });
});

describe('insert ids', () => {
  it('builds deterministic success insert id', () => {
    expect(paymentSuccessInsertId('ND-week-1')).toBe('pay_success:ND-week-1');
  });
  it('builds deterministic failed insert id', () => {
    expect(paymentFailedInsertId('ND-week-1')).toBe('pay_failed:ND-week-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./payment`.

- [ ] **Step 3: Create `src/lib/analytics/payment.ts`**

```ts
export interface ParsedOrder {
  plan: string | null;
  ts: number | null;
}

export function parseOrderId(orderId: string): ParsedOrder {
  const match = /^ND-([a-z]+)-(\d+)$/i.exec((orderId || '').trim());
  if (!match) return { plan: null, ts: null };
  return { plan: match[1], ts: Number(match[2]) };
}

export function paymentSuccessInsertId(orderId: string): string {
  return `pay_success:${orderId}`;
}

export function paymentFailedInsertId(orderId: string): string {
  return `pay_failed:${orderId}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/payment.ts src/lib/analytics/payment.test.ts
git commit -m "feat(analytics): add order-id parsing and payment dedup helpers"
```

---

## Task 5: Events type + analytics facade (replaces `src/lib/analytics.ts`)

**Files:**
- Create: `src/lib/analytics/events.ts`
- Create: `src/lib/analytics/index.ts`
- Delete: `src/lib/analytics.ts`

**Interfaces:**
- Consumes: `toGa4Event`, `hashEmailForGa4` (Task 2); `getAnalyticsEnv`, `isAnalyticsEnabled` (Task 1).
- Produces: type `AnalyticsEvent`; type `EventProps = Record<string, string|number|boolean|undefined>`; interface `TrackOptions { insertId?: string; timestamp?: Date }`; `track(event: AnalyticsEvent, props?: EventProps, options?: TrackOptions): void`; `identify(email: string): void`; `resetIdentity(): void`; `capturePageview(path: string, props?: EventProps): void`.
- Note: `@/lib/analytics` continues to resolve (now to `index.ts`), so existing `import { track } from '@/lib/analytics'` keeps working.

- [ ] **Step 1: Create `src/lib/analytics/events.ts`** (preserves the existing event names and adds funnel events)

```ts
export type AnalyticsEvent =
  // Existing in-app events
  | 'menu_generated'
  | 'meal_viewed'
  | 'meal_consumed'
  | 'meal_rated'
  | 'meal_swapped'
  | 'meal_saved_favorite'
  | 'shopping_item_checked'
  | 'shopping_day_filter_used'
  | 'water_logged'
  | 'weight_logged'
  | 'streak_completed'
  | 'streak_badge_earned'
  | 'push_permission_granted'
  | 'push_permission_denied'
  | 'servings_changed'
  | 'weekly_summary_viewed'
  // Funnel events
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'payment_email_entered'
  | 'payment_consents_checked'
  | 'plan_selected'
  | 'checkout_started'
  | 'checkout_blocked'
  | 'redirected_to_liqpay'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'login_completed';
```

- [ ] **Step 2: Create `src/lib/analytics/index.ts`**

```ts
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
```

- [ ] **Step 3: Delete the old single-file module**

```bash
git rm src/lib/analytics.ts
```

- [ ] **Step 4: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: exit 0. (Existing `import { track } from '@/lib/analytics'` calls still resolve, now to `index.ts`. The new event union is a superset of the old one, so existing `track('menu_generated', …)` calls still type-check.)

- [ ] **Step 5: Run unit tests (no regressions)**

Run: `npm test`
Expected: PASS (env, ga4, attribution, payment).

- [ ] **Step 6: Commit**

```bash
git add src/lib/analytics/events.ts src/lib/analytics/index.ts
git commit -m "feat(analytics): add event taxonomy and track/identify facade"
```

---

## Task 6: AnalyticsProvider + TrackEvent helper, mounted in layout

**Files:**
- Create: `src/components/analytics/AnalyticsProvider.tsx`
- Create: `src/components/analytics/TrackEvent.tsx`
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `capturePageview` (Task 5), `captureAttribution` (Task 3), `isAnalyticsEnabled` (Task 1), `track` (Task 5), `readAttribution` (Task 3), `AnalyticsEvent` (Task 5).
- Produces: `<AnalyticsProvider>{children}</AnalyticsProvider>`; `<TrackEvent event={...} withUtmSource? />`.
- Verification: integration — `npx tsc --noEmit` + staging *Live Events* (no unit test).

- [ ] **Step 1: Create `src/components/analytics/AnalyticsProvider.tsx`**

```tsx
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
```

- [ ] **Step 2: Create `src/components/analytics/TrackEvent.tsx`**

```tsx
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
```

- [ ] **Step 3: Mount the provider in `src/app/layout.tsx`**

Add the import after the existing imports (line 3 area):

```tsx
import { AnalyticsProvider } from '@/components/analytics/AnalyticsProvider';
```

Replace the `<body>` contents:

```tsx
      <body className={`${nunito.className} ${poppins.variable} antialiased`}>
        <AnalyticsProvider>{children}</AnalyticsProvider>
      </body>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Manual verification note (staging)**

Record in the commit body: on staging (with keys set), load `/?utm_source=instagram&utm_medium=social&utm_campaign=bio`, navigate between pages, and confirm in PostHog *Live Events* that `$pageview` fires per route and `nd_attribution` is set in `localStorage`. In GA4 DebugView confirm `page_view` events. (Locally, with no keys, expect only `[analytics]` console logs.)

- [ ] **Step 6: Commit**

```bash
git add src/components/analytics/AnalyticsProvider.tsx src/components/analytics/TrackEvent.tsx src/app/layout.tsx
git commit -m "feat(analytics): init PostHog+GA4, manual pageviews, attribution capture"
```

---

## Task 7: Onboarding funnel events

**Files:**
- Modify: `src/app/onboarding/page.tsx`
- Modify: `src/app/onboarding/creating-plan/page.tsx:34`

**Interfaces:**
- Consumes: `<TrackEvent>` (Task 6), `track` (Task 5).
- Verification: `npx tsc --noEmit` + staging *Live Events*.

- [ ] **Step 1: Add `onboarding_started` to `src/app/onboarding/page.tsx`**

This is a server component; mount the client `TrackEvent` helper. Replace the file with:

```tsx
import CaloriesCalc from "@/components/onboardingPage/calcComponent";
import { TrackEvent } from "@/components/analytics/TrackEvent";

export default function Onboarding() {
  return (
    <div className='min-h-screen bg-white dark:bg-dark-body'>
      <TrackEvent event="onboarding_started" withUtmSource />
      <main className='text-[#21201C] dark:text-main-title-black'>
        <CaloriesCalc />
      </main>
      <footer className=''></footer>
    </div>
  );
}
```

- [ ] **Step 2: Add `onboarding_completed` to `src/app/onboarding/creating-plan/page.tsx`**

Add the import after line 7 (`import { getOnboardingData } …`):

```tsx
import { track } from '@/lib/analytics';
```

Then, inside the `if (response.ok) {` block (currently around line 29-34), fire the event immediately before the redirect:

```tsx
          if (response.ok) {
            // Clear local storage after successful submission
            // clearOnboardingData(); // Uncomment when ready

            track('onboarding_completed');
            // Redirect to dashboard or results page
            router.push('/payment/plan');
          }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual verification note (staging)**

On staging: entering `/onboarding` fires `onboarding_started` (with `utm_source`); completing the questionnaire fires `onboarding_completed` right before navigation to `/payment/plan`.

- [ ] **Step 5: Commit**

```bash
git add src/app/onboarding/page.tsx src/app/onboarding/creating-plan/page.tsx
git commit -m "feat(analytics): track onboarding_started and onboarding_completed"
```

---

## Task 8: Payment-page funnel events + identify + UTM passthrough

**Files:**
- Modify: `src/app/payment/plan/page.tsx`

**Interfaces:**
- Consumes: `track`, `identify` (Task 5); `readAttribution` (Task 3); `PLANS` (`@/lib/plans`, already imported).
- Produces: into the `/api/subscription/init` request body — `utmSource`, `utmMedium`, `utmCampaign` (consumed by Task 11).
- Verification: `npx tsc --noEmit` + staging *Live Events*.

- [ ] **Step 1: Add imports**

After the existing imports in `src/app/payment/plan/page.tsx` (after line 13 `import { PLANS, type PlanId } …`):

```tsx
import { track, identify } from '@/lib/analytics';
import { readAttribution } from '@/lib/analytics/attribution';
```

- [ ] **Step 2: Add fire-once refs near the component state** (after line 37 `const [agreeOferta, setAgreeOferta] = useState(false);`)

```tsx
  const emailEnteredFired = React.useRef(false);
  const consentsFired = React.useRef(false);
```

- [ ] **Step 3: Fire `payment_email_entered` in the email-persist effect** (the effect at lines 68-75)

Replace that effect with:

```tsx
  // Persist email with a light debounce
  useEffect(() => {
    const id = setTimeout(() => {
      if (email && email.includes('@')) {
        setOnboardingData('email', email);
        if (!emailEnteredFired.current) {
          emailEnteredFired.current = true;
          track('payment_email_entered');
        }
      }
    }, 400);
    return () => clearTimeout(id);
  }, [email]);
```

- [ ] **Step 4: Fire `payment_consents_checked` when both consents are set**

Add this effect immediately after the email-persist effect:

```tsx
  useEffect(() => {
    if (agreePersonalData && agreeOferta && !consentsFired.current) {
      consentsFired.current = true;
      track('payment_consents_checked');
    }
  }, [agreePersonalData, agreeOferta]);
```

- [ ] **Step 5: Track `plan_selected` on plan toggle** (the plan button `onClick` at line 217)

Replace `onClick={() => setSelectedPlan(id)}` with:

```tsx
                  onClick={() => {
                    setSelectedPlan(id);
                    track('plan_selected', { plan: id });
                  }}
```

- [ ] **Step 6: Instrument `onPay()` — blocked/started/redirect + identify + UTM**

In `onPay` (lines 87-178): the two early validation `return`s become `checkout_blocked`, the successful path fires `checkout_started` + `identify`, the init body carries UTM, and the form submit is preceded by `redirected_to_liqpay`. Apply these edits:

Replace the consent guard (lines 89-92):

```tsx
    if (!agreePersonalData || !agreeOferta) {
      track('checkout_blocked', { reason: 'no_consent' });
      setError('Будь ласка, підтвердіть згоди перед оплатою.');
      return;
    }
```

Replace the email guard (lines 93-96):

```tsx
    if (!email || !email.includes('@')) {
      track('checkout_blocked', { reason: 'invalid_email' });
      setError('Вкажіть коректний email для отримання доступу.');
      return;
    }
```

Immediately after `setSubmitting(true);` (line 98) and the `const plan = PLANS[selectedPlan];` / `const orderId = …` lines (101), add the started event + identify (place right after `const orderId = ...` assignment, line 101):

```tsx
      const attribution = readAttribution(window.localStorage);
      track('checkout_started', { plan: selectedPlan, amount: plan.amount });
      identify(email);
```

Add UTM to the init request body (lines 111-117) so it becomes:

```tsx
        body: JSON.stringify({
          email,
          onboardingData: data,
          planId: selectedPlan,
          orderId,
          utmSource: attribution.utmSource,
          utmMedium: attribution.utmMedium,
          utmCampaign: attribution.utmCampaign,
        }),
```

Fire `redirected_to_liqpay` immediately before `form.submit();` (line 172):

```tsx
      track('redirected_to_liqpay', { plan: selectedPlan, orderId });
      document.body.appendChild(form);
      form.submit();
```

- [ ] **Step 7: Add `ph-no-capture` to the email input** (line 245, the email `<input>`)

Change its `className` to include `ph-no-capture`:

```tsx
            className="ph-no-capture w-full p-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-transparent outline-none"
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 9: Manual verification note (staging)**

On staging: typing a valid email fires `payment_email_entered` once; ticking both consents fires `payment_consents_checked`; clicking pay with missing consent/email fires `checkout_blocked` with the right `reason`; a valid click fires `checkout_started`, calls `identify(email)` (anonymous events merge onto the email person in PostHog), and fires `redirected_to_liqpay` before leaving for LiqPay.

- [ ] **Step 10: Commit**

```bash
git add src/app/payment/plan/page.tsx
git commit -m "feat(analytics): instrument payment page funnel + identify + UTM passthrough"
```

---

## Task 9: Client payment result events (`payment_succeeded` / `payment_failed`)

**Files:**
- Modify: `src/app/payment/result/page.tsx`

**Interfaces:**
- Consumes: `track`, `identify` (Task 5); `parseOrderId`, `paymentSuccessInsertId`, `paymentFailedInsertId` (Task 4); `PLANS`, `isPlanId` (`@/lib/plans`).
- Note: uses the deterministic `$insert_id` + timestamp (from `orderId`) so this client event and the Phase 2 server event for the same order **deduplicate** in PostHog. GA4 `purchase` dedups via `transaction_id`.
- Verification: `npx tsc --noEmit` + staging *Live Events*.

- [ ] **Step 1: Add imports** (after line 7 `import { getOnboardingData } …`)

```tsx
import { track, identify } from '@/lib/analytics';
import { parseOrderId, paymentSuccessInsertId, paymentFailedInsertId } from '@/lib/analytics/payment';
import { PLANS, isPlanId } from '@/lib/plans';
```

- [ ] **Step 2: Add a fire-once ref** (after line 34 `const [autoMagicSent, setAutoMagicSent] = useState(false);`)

```tsx
  const paymentEventFired = React.useRef(false);
```

(`React` is already imported at line 3.)

- [ ] **Step 3: Add an effect that fires the payment outcome event once**

Add immediately after the auto-magic-link effect (after line 167):

```tsx
  useEffect(() => {
    if (paymentEventFired.current) return;
    if (!orderId) return;
    if (!isPaid && !isFailed) return;

    paymentEventFired.current = true;
    const { plan, ts } = parseOrderId(orderId);
    const amount = plan && isPlanId(plan) ? PLANS[plan].amount : undefined;
    const currency = plan && isPlanId(plan) ? PLANS[plan].currency : 'UAH';
    const timestamp = ts ? new Date(ts) : undefined;

    if (resolvedEmail) identify(resolvedEmail);

    if (isPaid) {
      track(
        'payment_succeeded',
        { plan: plan ?? undefined, amount, currency, orderId },
        { insertId: paymentSuccessInsertId(orderId), timestamp },
      );
    } else {
      track(
        'payment_failed',
        { status: effectiveStatus, orderId },
        { insertId: paymentFailedInsertId(orderId), timestamp },
      );
    }
  }, [isPaid, isFailed, orderId, resolvedEmail, effectiveStatus]);
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Manual verification note (staging, sandbox LiqPay)**

On staging: completing a sandbox payment and landing on `/payment/result` fires exactly one `payment_succeeded` (PostHog) with `plan`/`amount`/`currency`/`orderId` and a GA4 `purchase` with `transaction_id=orderId`; a failed/cancelled payment fires one `payment_failed`.

- [ ] **Step 6: Commit**

```bash
git add src/app/payment/result/page.tsx
git commit -m "feat(analytics): client payment_succeeded/failed on result page with dedup"
```

---

## Task 10: `login_completed` + identify on confirm

**Files:**
- Modify: `src/app/api/auth/magic-link/consume/route.ts`
- Modify: `src/app/auth/confirm/page.tsx`

**Interfaces:**
- Consumes: `track`, `identify` (Task 5).
- Produces: the consume POST response gains an `email` field (consumed by `auth/confirm`).
- Verification: `npx tsc --noEmit` + staging *Live Events*.

- [ ] **Step 1: Return `email` from the consume handler**

In `src/app/api/auth/magic-link/consume/route.ts`, change the `ConsumeResult` success shape (line 13) to include email:

```ts
type ConsumeResult =
  | { ok: true; redirect: string; email: string }
  | { ok: false; error: string };
```

Update the two success `return` sites inside `processMagicToken` (lines 155 and 159) to include the email:

```ts
  if (subscriptionActive) {
    return { ok: true, redirect: '/menu', email: String(user.email) };
  }

  // No valid subscription: returning user → payment page, unknown user → onboarding.
  return { ok: true, redirect: inactiveRedirectTarget(userExists), email: String(user.email) };
```

Update the POST success response (line 178):

```ts
    return NextResponse.json({ success: true, redirect: result.redirect, email: result.email });
```

- [ ] **Step 2: Fire `login_completed` + identify in `src/app/auth/confirm/page.tsx`**

Add imports after line 5 (`import { OnboardingLayout } …`):

```tsx
import { track, identify } from '@/lib/analytics';
```

Update the response type and the success branch inside `onConfirm` (lines 42-49):

```tsx
      const data = (await res.json().catch(() => null)) as
        | { success?: boolean; redirect?: string; error?: string; email?: string }
        | null;

      if (res.ok && data?.success && data.redirect) {
        if (data.email) identify(data.email);
        track('login_completed');
        router.push(data.redirect);
        return;
      }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual verification note (staging)**

On staging: clicking the magic link and confirming login fires `login_completed` and `identify(email)`, closing the funnel on the same email person.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/magic-link/consume/route.ts src/app/auth/confirm/page.tsx
git commit -m "feat(analytics): track login_completed and identify on confirm"
```

**END OF PHASE 1.** The full funnel is now visible in PostHog using the client-side `payment_succeeded`.

---

# PHASE 2 — Authoritative server-side payment events + DB attribution

## Task 11: Store UTM attribution on the `users` record via init

**Files:**
- Modify: `src/app/api/subscription/init/route.ts`

**Interfaces:**
- Consumes: `utmSource`/`utmMedium`/`utmCampaign` from the request body (sent by Task 8).
- Produces: `users.utmSource`/`utmMedium`/`utmCampaign` (consumed by Tasks 13 & 14).
- Verification: `npx tsc --noEmit` + staging.

- [ ] **Step 1: Extend the request body type** (lines 12-17)

```ts
interface InitSubscriptionBody {
  email?: string;
  onboardingData?: Record<string, any>;
  planId?: PlanId;
  orderId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}
```

- [ ] **Step 2: Read the UTM fields** (after line 22 `const { onboardingData, planId, orderId } = body || {};`)

```ts
    const { onboardingData, planId, orderId, utmSource, utmMedium, utmCampaign } = body || {};
```

- [ ] **Step 3: Persist UTM on insert** (the `users.insertOne` at lines 52-61) — add the three fields:

```ts
      await users.insertOne({
        email,
        planId: planId || null,
        orderId: orderId || null,
        status: 'pending',
        paymentStatus: 'pending',
        onboarding: onboardingData || {},
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        createdAt: now,
        updatedAt: now,
      });
```

- [ ] **Step 4: Persist UTM on update** (the `users.updateOne` `$set` at lines 74-81) — first-touch wins, so only set when not already present using `$setOnInsert`-style guard via separate `$set` keys that don't overwrite with null. Replace the `updateOne` call with:

```ts
    await users.updateOne(
      { email },
      {
        $set: {
          planId: planId || null,
          orderId: orderId || null,
          status: 'pending',
          paymentStatus: 'pending',
          onboarding: onboardingData || {},
          updatedAt: now,
          ...(utmSource ? { utmSource } : {}),
          ...(utmMedium ? { utmMedium } : {}),
          ...(utmCampaign ? { utmCampaign } : {}),
        },
      }
    );
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/subscription/init/route.ts
git commit -m "feat(analytics): persist UTM attribution on users via init"
```

---

## Task 12: Server-side PostHog capture module

**Files:**
- Create: `src/lib/analytics/posthog.server.ts`
- Test: `src/lib/analytics/posthog.server.test.ts`

**Interfaces:**
- Consumes: `parseOrderId`, `paymentSuccessInsertId`, `paymentFailedInsertId` (Task 4); `posthog-node` (`PostHog`).
- Produces: interface `PaymentCaptureInput`; `buildPaymentCaptureArgs(input): { distinctId; event; properties; timestamp }` (pure, tested); `capturePaymentEvent(input): Promise<void>` (integration: creates client, captures, flushes, shuts down).
- Note: `buildPaymentCaptureArgs` is the pure, unit-tested core; `capturePaymentEvent` is the thin network wrapper (no unit test — verified on staging).

- [ ] **Step 1: Write the failing test** — `src/lib/analytics/posthog.server.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { buildPaymentCaptureArgs } from './posthog.server';

describe('buildPaymentCaptureArgs', () => {
  it('builds a success capture keyed on email with deterministic insert id + timestamp', () => {
    const args = buildPaymentCaptureArgs({
      email: 'a@b.com',
      event: 'payment_succeeded',
      orderId: 'ND-week-1719700000000',
      plan: 'week',
      amount: 99,
      currency: 'UAH',
      utmSource: 'instagram',
    });
    expect(args.distinctId).toBe('a@b.com');
    expect(args.event).toBe('payment_succeeded');
    expect(args.properties.$insert_id).toBe('pay_success:ND-week-1719700000000');
    expect(args.properties.plan).toBe('week');
    expect(args.properties.amount).toBe(99);
    expect(args.properties.utm_source).toBe('instagram');
    expect(args.timestamp).toEqual(new Date(1719700000000));
  });

  it('uses the failed insert id for payment_failed', () => {
    const args = buildPaymentCaptureArgs({
      email: 'a@b.com',
      event: 'payment_failed',
      orderId: 'ND-month-1719700000001',
      status: 'failure',
    });
    expect(args.properties.$insert_id).toBe('pay_failed:ND-month-1719700000001');
    expect(args.properties.status).toBe('failure');
  });

  it('leaves timestamp undefined for a malformed order id', () => {
    const args = buildPaymentCaptureArgs({ email: 'a@b.com', event: 'payment_failed', orderId: 'x' });
    expect(args.timestamp).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — cannot find module `./posthog.server`.

- [ ] **Step 3: Create `src/lib/analytics/posthog.server.ts`**

```ts
import { PostHog } from 'posthog-node';
import { parseOrderId, paymentSuccessInsertId, paymentFailedInsertId } from './payment';

export interface PaymentCaptureInput {
  email: string;
  event: 'payment_succeeded' | 'payment_failed';
  orderId: string;
  plan?: string | null;
  amount?: number;
  currency?: string;
  utmSource?: string | null;
  status?: string;
}

export interface PaymentCaptureArgs {
  distinctId: string;
  event: string;
  properties: Record<string, unknown>;
  timestamp?: Date;
}

export function buildPaymentCaptureArgs(input: PaymentCaptureInput): PaymentCaptureArgs {
  const { ts } = parseOrderId(input.orderId);
  const insertId =
    input.event === 'payment_succeeded'
      ? paymentSuccessInsertId(input.orderId)
      : paymentFailedInsertId(input.orderId);

  return {
    distinctId: input.email,
    event: input.event,
    properties: {
      $insert_id: insertId,
      plan: input.plan ?? null,
      amount: input.amount,
      currency: input.currency ?? 'UAH',
      utm_source: input.utmSource ?? null,
      status: input.status ?? null,
      orderId: input.orderId,
      env: process.env.NEXT_PUBLIC_ANALYTICS_ENV || 'prod',
    },
    timestamp: ts ? new Date(ts) : undefined,
  };
}

export async function capturePaymentEvent(input: PaymentCaptureInput): Promise<void> {
  const key = process.env.POSTHOG_API_KEY;
  if (!key) return; // local/dev — no server capture
  const client = new PostHog(key, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  });
  try {
    client.capture(buildPaymentCaptureArgs(input));
    await client.flush();
  } catch (err) {
    console.error('[analytics] server payment capture failed', err);
  } finally {
    await client.shutdown();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/analytics/posthog.server.ts src/lib/analytics/posthog.server.test.ts
git commit -m "feat(analytics): add server-side payment capture module"
```

---

## Task 13: Wire authoritative payment events into the LiqPay callback

**Files:**
- Modify: `src/app/api/liqpay/callback/route.ts`

**Interfaces:**
- Consumes: `capturePaymentEvent` (Task 12); `PLANS`, `isPlanId` (already imported in this file); `users.utmSource` (Task 11).
- Note: fire only on the genuine status transition (the existing `previousPaymentStatus !== 'active'` guard already prevents double-firing across callback retries and the consume path). The deterministic `$insert_id` is the secondary safeguard.
- Verification: `npx tsc --noEmit` + staging sandbox.

- [ ] **Step 1: Add the import** (after line 8 `import { PLANS, isPlanId } from '@/lib/plans';`)

```ts
import { capturePaymentEvent } from '@/lib/analytics/posthog.server';
```

- [ ] **Step 2: Capture `payment_succeeded` on activation**

Inside the `if (paymentStatus === 'active')` block, the existing `if (previousPaymentStatus !== 'active')` guard (lines 181-188) sends the magic link. Add the analytics capture in that same guarded block, after the magic-link send:

```ts
        if (previousPaymentStatus !== 'active') {
          const loginEmail = (user as any).email || email || senderEmail;
          if (loginEmail) {
            const { token } = await issueMagicLinkToken(loginEmail);
            await sendMagicLinkEmail(loginEmail, token);

            await capturePaymentEvent({
              email: String(loginEmail).trim().toLowerCase(),
              event: 'payment_succeeded',
              orderId: orderId ?? '',
              plan: effectivePlanId,
              amount: isPlanId(effectivePlanId) ? PLANS[effectivePlanId].amount : undefined,
              currency: isPlanId(effectivePlanId) ? PLANS[effectivePlanId].currency : undefined,
              utmSource: (user as any).utmSource ?? null,
            });
          }
        }
```

- [ ] **Step 3: Capture `payment_failed` on a failed transition**

After the `if (user) { … }` block closes (after line 189, before `return NextResponse.json({ success: true });` at line 191), add:

```ts
    if (user && paymentStatus === 'failed' && (user as any).paymentStatus !== 'failed') {
      const failEmail = (user as any).email || email || senderEmail;
      if (failEmail) {
        await capturePaymentEvent({
          email: String(failEmail).trim().toLowerCase(),
          event: 'payment_failed',
          orderId: orderId ?? '',
          status: status ?? undefined,
          utmSource: (user as any).utmSource ?? null,
        });
      }
    }
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Manual verification note (staging sandbox)**

On staging with sandbox LiqPay configured to hit the public `server_url`: a successful sandbox payment produces exactly one authoritative `payment_succeeded` in PostHog (server), and it does NOT double-count with the client event from Task 9 (same `$insert_id` + timestamp from `orderId`). Confirm the event carries `utm_source` from the `users` record.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/liqpay/callback/route.ts
git commit -m "feat(analytics): emit authoritative server payment events from LiqPay callback"
```

---

## Task 14: Wire server payment event into the magic-link reconciliation path

**Files:**
- Modify: `src/app/api/auth/magic-link/consume/route.ts`

**Interfaces:**
- Consumes: `capturePaymentEvent` (Task 12); `PLANS`, `isPlanId` (`@/lib/plans`).
- Note: this is the second activation path (used in local/sandbox where the callback can't reach `localhost`). It fires only when reconciliation flips status to `active` (`updateTo === 'active'`), and the shared `$insert_id` dedups against the callback path.
- Verification: `npx tsc --noEmit` + local (reconciliation path) and staging.

- [ ] **Step 1: Add imports** (after line 8 `import { calcCalories, normalizeSex } from '@/lib/calories';`)

```ts
import { capturePaymentEvent } from '@/lib/analytics/posthog.server';
import { PLANS, isPlanId } from '@/lib/plans';
```

- [ ] **Step 2: Capture `payment_succeeded` when reconciliation activates**

Inside the `if (updateTo) { … }` block, after the `users.updateOne` that sets `paymentStatus` (after line 87 `paymentStatus = updateTo;`), add:

```ts
          if (updateTo === 'active') {
            await capturePaymentEvent({
              email: String(user.email).trim().toLowerCase(),
              event: 'payment_succeeded',
              orderId: String(latestUser?.orderId ?? ''),
              plan: latestUser?.planId ?? null,
              amount: isPlanId(latestUser?.planId) ? PLANS[latestUser.planId as 'week' | 'month'].amount : undefined,
              currency: isPlanId(latestUser?.planId) ? PLANS[latestUser.planId as 'week' | 'month'].currency : undefined,
              utmSource: (latestUser as any)?.utmSource ?? null,
            });
          }
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual verification note (local + staging)**

Locally (sandbox, no public callback): completing a payment and then logging in via the magic link triggers reconciliation, which fires one server `payment_succeeded`. On staging where the callback already fired, the consume path must NOT add a second event — confirm dedup via the shared `$insert_id`/timestamp.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/magic-link/consume/route.ts
git commit -m "feat(analytics): emit server payment event on magic-link reconciliation"
```

**END OF PHASE 2.**

---

## Post-implementation: PostHog/GA4 dashboard setup (no code)

These are console-configuration steps, done once after deploy — not part of the code tasks:

- [ ] In PostHog, create the funnel: `$pageview (/)` → `onboarding_started` → `onboarding_completed` → `payment_email_entered` → `payment_consents_checked` → `checkout_started` → `redirected_to_liqpay` → `payment_succeeded` → `login_completed`.
- [ ] Add a breakdown by `$initial_utm_source` (and/or event `utm_source`) to compare Instagram vs partner.
- [ ] Build a dashboard pinning the funnel + conversion rate + drop-off table.
- [ ] In GA4, mark `purchase` as a key event/conversion and confirm acquisition reports show `instagram` / `partner` sources.

---

## Self-Review

**1. Spec coverage** (each spec section → task):
- §3 architecture (facade fan-out, provider, server module, ENV): Tasks 1, 5, 6, 12. ✓
- §3 PostHog flags (`autocapture:false`, `capture_pageview:false`, `disable_session_recording:true`, `person_profiles:'always'`): Task 6 Step 1. ✓
- §3 split identify (PostHog clean email / GA4 sha256): Task 5 (`identify`), Task 2 (`hashEmailForGa4`). ✓
- §4 event taxonomy incl. payment-page micro-events + client `payment_succeeded` + `plan_selected` as segment: Tasks 7, 8, 9, 10. ✓
- §5 UTM convention + capture + localStorage persist + DB persist: Tasks 1 (.env), 3, 6, 8, 11. ✓
- §6 identity points (checkout, result, login) + server payment events + dedup by orderId + flush: Tasks 8, 9, 10, 12, 13, 14. ✓
- §7 consent/privacy (no banner, flags, person_profiles=always): reflected in Task 6 flags + Global Constraints; policy text is a content task noted in Global Constraints (not code). ✓
- §8 three environments + `env` prop + tsc/staging verification: Task 1 (env helper), Global Constraints, per-task verification steps. ✓
- §9 phases: Phase 1 = Tasks 1-10; Phase 2 = Tasks 11-14; Phase 3 explicitly deferred (not planned). ✓
- §10 done-criteria: full funnel after Phase 1 (client `payment_succeeded`), authoritative server in Phase 2. ✓

**2. Placeholder scan:** No "TBD/TODO/handle edge cases" — every code step shows complete code. ✓

**3. Type consistency:** `track(event, props, options)` signature defined in Task 5 and used with that arity in Tasks 7-10. `parseOrderId` returns `{ plan, ts }` (Task 4) and consumed as such in Tasks 9, 12. `paymentSuccessInsertId`/`paymentFailedInsertId` names consistent across Tasks 4, 9, 12. `buildPaymentCaptureArgs`/`capturePaymentEvent`/`PaymentCaptureInput` consistent across Tasks 12, 13, 14. `Attribution` field names (`utmSource` etc.) consistent across Tasks 3, 8, 11. Consume response `email` field added in Task 10 and consumed there. ✓

**Note for executor:** `posthog-js` / `posthog-node` API option names (`person_profiles`, `capture` options `timestamp`, client constructor `flushAt`/`flushInterval`) should be confirmed against the installed version during Task 6/12; if an option name differs, keep the documented intent (no autocapture, no auto-pageview, no recording, identified+anon profiles, immediate server flush).
