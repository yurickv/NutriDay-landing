# Loading Speed Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Зменшити час завантаження сторінок квізу `/onboarding/[step]` і сторінки оплати `/payment/plan` без зміни поведінки воронки, платіжного флоу та подій аналітики.

**Architecture:** PostHog виноситься з критичного бандла через динамічний `import()` з чергою подій; легасі-шрифти прибираються з root layout; кроки квізу стають статичними з prefetch сусідніх кроків; сторінка оплати отримує серверну обгортку, що читає куку знижки; великі AVIF стискаються; слайдер втрачає зайві `priority`.

**Tech Stack:** Next.js 15.5 (App Router), React 19, TypeScript 5, Tailwind 4, Vitest 4, sharp 0.34 (вже в node_modules), posthog-js.

**Spec:** `docs/superpowers/specs/2026-08-18-loading-speed-optimization-design.md`

**Затверджене відхилення від спеки:** idle-обгортка для `initAnalytics()` у AnalyticsProvider НЕ реалізується. Причина: `PageviewTracker` стріляє `$pageview` на маунті, що все одно запускає завантаження PostHog; виграш дає сам динамічний `import()` (чанк поза First Load JS), а затримка до idle лише відклала б флаш черги. Спека правиться у Task 2.

## Global Constraints

- **НІКОЛИ не запускати `next build`, поки працює `next dev`** — build перезаписує `.next/` і dev-сервер віддає 500 на всі роути. Перед кожним build перевіряти, що порт 3000 вільний.
- Тип-чек під час роботи: `npx tsc --noEmit` (НЕ build).
- Публічний API фасаду аналітики (`track`, `identify`, `capturePageview`, `resetIdentity`, `initAnalytics`) не змінюється — жодних правок у споживачах.
- Український копірайт (тексти FAQ, кнопок, підписів) копіюється дослівно, без редагувань.
- Платіжна логіка (`onPay`, `/api/subscription/init`, `/api/liqpay/checkout`, форма LiqPay) не змінюється ні на символ.
- Коміт наприкінці кожної задачі. Формат: `perf(scope): ...` або `refactor(scope): ...`, наприкінці повідомлення: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Кольори/токени зі старої (orange) теми в `globals.css` не чіпати, крім явно вказаних рядків Nunito/Poppins.

---

### Task 0: Базлайн для порівняння

**Files:**
- Create: `build-baseline.txt` (НЕ комітиться — тимчасовий артефакт у корені)

**Interfaces:**
- Produces: `build-baseline.txt` з таблицею First Load JS і списком роутів; використовується у Task 10 для порівняння.

- [ ] **Step 1: Переконатися, що dev-сервер не працює**

Run (PowerShell): `Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue`
Expected: порожній вивід (exit code 1 — нічого не слухає). Якщо є процес — зупинити його і лише потім продовжувати.

- [ ] **Step 2: Зібрати базлайн**

Run (Git Bash, з кореня репо):
```bash
npm run build 2>&1 | tee build-baseline.txt
du -ah public/onboarding | sort -rh >> build-baseline.txt
```
Expected: build завершується без помилок; у файлі — таблиця роутів з розмірами (звернути увагу на First Load JS shared, `/onboarding/[step]` позначений `ƒ` (Dynamic), `/payment/plan` — `○` (Static)).

- [ ] **Step 3: Нічого не комітити** — файл лишається untracked, видалиться у Task 10.

---

### Task 1: Лінивий PostHog у фасаді аналітики

**Files:**
- Modify: `src/lib/analytics/index.ts` (повна заміна вмісту)
- Test: `src/lib/analytics/index.test.ts`

**Interfaces:**
- Consumes: `posthog-js` (динамічний import), `./events`, `./ga4`, `./env` — без змін.
- Produces: той самий публічний API: `track(event, props?, options?)`, `identify(email)`, `resetIdentity()`, `capturePageview(path, props?)`, `initAnalytics()`. Семантика: виклики до завантаження posthog-js стають у чергу зі своїм timestamp і флашаться після init; gtag-гілка синхронна, як була.

- [ ] **Step 1: Оновити тести під асинхронну ініціалізацію**

У `src/lib/analytics/index.test.ts`:

1. Після функції `loadFacade()` додати хелпер:

```ts
// Динамічний import('posthog-js') + .then() резолвляться асинхронно;
// один макротаск гарантує, що init і флаш черги вже відбулися.
async function flushDynamicImport() {
  await new Promise((r) => setTimeout(r, 0));
}
```

2. У КОЖНОМУ тесті, який після виклику `track`/`identify`/`capturePageview`/`initAnalytics` перевіряє `posthogMock.*`, вставити `await flushDynamicImport();` між викликом і assertions. Конкретно (7 тестів):
   - `initializes posthog before the first capture`
   - `initializes posthog only once across multiple calls`
   - `passes key and host from env to init`
   - `initializes posthog before identify even without a prior track`
   - `does nothing when analytics is disabled (no posthog key)` (щоб довести, що init не станеться навіть після тіку)
   - `initAnalytics prepares posthog and the gtag queue without emitting events`
   - обидва тести в `describe('track beacon option for pre-navigation events')`

   Тести, що перевіряють ЛИШЕ `dataLayer` (`creates a gtag stub…`, `does not re-run config…`), не чіпати — gtag лишається синхронним.

3. Додати новий describe наприкінці файлу:

```ts
describe('queueing before posthog-js module loads', () => {
  it('queues events fired before the module resolves and flushes them in order with own timestamps', async () => {
    const { track } = await loadFacade();
    track('onboarding_started');
    track('water_logged', { amount: 250 });

    // Модуль ще не резолвнувся — жодного capture синхронно.
    expect(posthogMock.capture).not.toHaveBeenCalled();

    await flushDynamicImport();

    expect(posthogMock.init).toHaveBeenCalledTimes(1);
    expect(posthogMock.capture).toHaveBeenCalledTimes(2);
    expect(posthogMock.capture.mock.calls[0][0]).toBe('onboarding_started');
    expect(posthogMock.capture.mock.calls[1][0]).toBe('water_logged');
    // Черга зберігає реальний час події.
    expect(posthogMock.capture.mock.calls[0][2]?.timestamp).toBeInstanceOf(Date);
  });

  it('captures directly without auto timestamp once the module is loaded', async () => {
    const { track } = await loadFacade();
    track('water_logged');
    await flushDynamicImport();

    track('weight_logged');
    const last = posthogMock.capture.mock.calls.at(-1);
    expect(last?.[0]).toBe('weight_logged');
    expect(last?.[2]).toBeUndefined();
  });

  it('queues identify fired before the module resolves', async () => {
    const { identify } = await loadFacade();
    identify('a@b.com');
    expect(posthogMock.identify).not.toHaveBeenCalled();

    await flushDynamicImport();
    expect(posthogMock.identify).toHaveBeenCalledWith('a@b.com');
  });
});
```

Якщо `onboarding_started` не входить у тип `AnalyticsEvent` — замінити на будь-яку наявну назву з `src/lib/analytics/events.ts` (перевірити перед запуском).

- [ ] **Step 2: Запустити тести — нові мають впасти**

Run: `npm test -- src/lib/analytics/index.test.ts`
Expected: FAIL — щонайменше `queues events fired before the module resolves…` падає, бо стара реалізація викликає `posthog.capture` синхронно (`expect(posthogMock.capture).not.toHaveBeenCalled()` не проходить).

- [ ] **Step 3: Переписати `src/lib/analytics/index.ts`**

Повний новий вміст файлу:

```ts
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
  ensureGtag()?.('event', 'page_view', { page_path: path });
}
```

- [ ] **Step 4: Запустити тести фасаду**

Run: `npm test -- src/lib/analytics/index.test.ts`
Expected: PASS (усі describe, включно з новим `queueing before posthog-js module loads`).

- [ ] **Step 5: Повний прогін тестів і тип-чек**

Run: `npm test && npx tsc --noEmit`
Expected: обидва exit 0. Якщо інші тест-файли аналітики (`payment.test.ts`, `ga4.test.ts` тощо) впали через синхронні очікування posthog — додати в них той самий `await flushDynamicImport()` паттерн.

- [ ] **Step 6: Commit**

```bash
git add src/lib/analytics/index.ts src/lib/analytics/index.test.ts
git commit -m "perf(analytics): lazy-load posthog-js via dynamic import with event queue

posthog-js (~60KB gzip) more не входить у First Load JS. Події до
завантаження чанка стають у чергу зі своїм timestamp і флашаться після
init. Публічний API фасаду без змін.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Правка спеки — idle-init не потрібен

**Files:**
- Modify: `docs/superpowers/specs/2026-08-18-loading-speed-optimization-design.md`

**Interfaces:** нема (документація).

- [ ] **Step 1: Замінити bullet про requestIdleCallback**

У розділі «### 1. Аналітика: лінивий PostHog» рядок:

```
- `AnalyticsProvider` викликає `initAnalytics()` через `requestIdleCallback`
  (fallback `setTimeout(2000)`).
```

замінити на:

```
- `AnalyticsProvider` НЕ змінюється: PageviewTracker стріляє $pageview на маунті,
  що однаково запускає завантаження чанка; виграш дає сам динамічний import()
  (поза First Load JS), а idle-затримка лише відклала б флаш черги подій.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-08-18-loading-speed-optimization-design.md
git commit -m "docs: spec amendment — drop idle-init for analytics provider

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Шрифти — Poppins геть, Nunito лише на старих сторінках

**Files:**
- Create: `src/lib/fonts/legacy.ts`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/profile/layout.tsx`
- Modify: `src/app/shopping-list/layout.tsx`

**Interfaces:**
- Produces: `src/lib/fonts/legacy.ts` експортує `nunito` (результат `Nunito()` з `next/font/google`; має `.className: string`). Споживачі — лише layout'и profile та shopping-list.

- [ ] **Step 1: Створити `src/lib/fonts/legacy.ts`**

```ts
// Nunito — легасі-шрифт сторінок, ще не відрестайлених під бренд-бук
// (/profile, /shopping-list). Живе поза root layout, щоб woff2 не
// прелоадились на квізі, оплаті й лендінгу. При рестайлі цих сторінок
// файл видалити разом з імпортами.
import { Nunito } from 'next/font/google';

export const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
});
```

(без `variable` — CSS-змінна `--font-nunito` більше ніде не використовується.)

- [ ] **Step 2: Прибрати Nunito/Poppins з root layout**

У `src/app/layout.tsx`:

1. Рядок імпорту шрифтів замінити:
```ts
import { Comfortaa, Manrope, Caprasimo } from 'next/font/google';
```
2. Видалити повністю блоки `const poppins = Poppins({...});` і `const nunito = Nunito({...});`.
3. body className замінити:

```tsx
<body className={`${comfortaa.variable} ${manrope.variable} ${caprasimo.variable} font-body antialiased`}>
```

(`font-body` — Tailwind-утиліта з `@theme` (`--font-body: var(--font-manrope)`): Manrope стає базовим шрифтом body замість Nunito; бренд-сторінки й так рендеряться в ньому.)

- [ ] **Step 3: Почистити globals.css**

У `src/app/globals.css` видалити:

1. Рядки в `:root` (зараз 73–74):
```css
  --font-nunito: var(--font-nunito);
  --font-poppins: var(--font-poppins);
```
2. Утиліти (зараз 89–97) — видалити разом із коментарем `/* Кастомні класи для шрифтів */`:
```css
@layer utilities {
  .font-nunito {
    font-family: var(--font-nunito);
  }

  .font-poppins {
    font-family: var(--font-poppins);
  }
}
```
УВАГА: `}.div-container` на рядку 98 злиплий з попереднім блоком — після видалення утиліт правило `.div-container { ... }` має ЛИШИТИСЯ неушкодженим.

- [ ] **Step 4: Підключити Nunito на старих сторінках**

`src/app/profile/layout.tsx` — обгорнути children:

```tsx
import { redirect } from 'next/navigation';
import { checkSessionSubscription, inactiveRedirectTarget } from '@/lib/subscription';
import { nunito } from '@/lib/fonts/legacy';

// Server guard: blocks access when the subscription is missing or expired.
// The page renders its own AppShell, so this layout only enforces access.
// Nunito: базовий шрифт цієї ще не відрестайленої сторінки (був на body).
export default async function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { active, userExists } = await checkSessionSubscription();
  if (!active) redirect(inactiveRedirectTarget(userExists));

  return <div className={nunito.className}>{children}</div>;
}
```

`src/app/shopping-list/layout.tsx` — аналогічно:

```tsx
import { redirect } from 'next/navigation';
import InstallBanner from '@/components/common/InstallBanner';
import { checkSessionSubscription, inactiveRedirectTarget } from '@/lib/subscription';
import { nunito } from '@/lib/fonts/legacy';

// Server guard: blocks access when the subscription is missing or expired.
// The page renders its own AppShell, so this layout only enforces access.
// Nunito: базовий шрифт цієї ще не відрестайленої сторінки (був на body).
export default async function ShoppingListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { active, userExists } = await checkSessionSubscription();
  if (!active) redirect(inactiveRedirectTarget(userExists));

  return (
    <div className={nunito.className}>
      {children}
      <InstallBanner />
    </div>
  );
}
```

- [ ] **Step 5: Тип-чек і перевірка залишків**

Run: `npx tsc --noEmit && grep -rn "Poppins\|font-poppins\|font-nunito" src/ || echo "clean"`
Expected: tsc exit 0; grep не знаходить нічого, крім `src/lib/fonts/legacy.ts` (там лише Nunito) → вивід `clean` або тільки legacy.ts.

- [ ] **Step 6: Commit**

```bash
git add src/lib/fonts/legacy.ts src/app/layout.tsx src/app/globals.css src/app/profile/layout.tsx src/app/shopping-list/layout.tsx
git commit -m "perf(fonts): drop Poppins, scope Nunito to legacy pages, Manrope as body default

Мінус 3-4 preload woff2 на квізі, оплаті та лендінгу.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: next.config — формати картинок і Cache-Control для AVIF

**Files:**
- Modify: `next.config.ts`

**Interfaces:** нема (конфігурація).

- [x] **Step 0: Наявна незакомічена зміна next.config.ts — ВИРІШЕНО**

Правка «withPWA лише в прод» закомічена окремо (`9031151`) під час планування. Перед стартом задачі перевірити `git status` — `next.config.ts` має бути чистим.

- [ ] **Step 1: Додати images і cache-заголовки**

У `next.config.ts` замінити блок `const nextConfig: NextConfig = {...}` на:

```ts
// Статичні AVIF версіонуються іменем файлу (домовленість: заміна картинки =
// нове ім'я), тому їм безпечно давати immutable-кеш на рік.
const immutableCacheHeader = [
  { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
];

const nextConfig: NextConfig = {
  images: {
    // Вихідні AVIF без цього перекодовуються в (частіше більший) WebP.
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2678400, // 31 доба
  },
  async headers() {
    return [
      {
        // Apply to every route.
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Лише файли картинок квізу, НЕ сторінки /onboarding/[step].
        source: '/onboarding/:file(.*\\.avif)',
        headers: immutableCacheHeader,
      },
      {
        // Скріншоти слайдера в корені public: /example-1.avif … /example-7.avif.
        source: '/:file(example-.*\\.avif)',
        headers: immutableCacheHeader,
      },
    ];
  },
};
```

- [ ] **Step 2: Тип-чек**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Швидка перевірка matcher'ів**

Переконатися, що dev-сервер НЕ запущений (порт 3000 вільний). Запустити `npm run dev` у фоні, дочекатись готовності, потім:

```bash
curl -s -o /dev/null -D - http://localhost:3000/onboarding/women.avif | grep -i cache-control
curl -s -o /dev/null -D - http://localhost:3000/onboarding/gender | grep -i cache-control
```
Expected: перший — `cache-control: public, max-age=31536000, immutable`; другий — НЕ immutable (стандартний no-store/no-cache для сторінки). Після перевірки dev-сервер зупинити.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "perf(config): serve AVIF via next/image, immutable cache for static quiz images

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Статичні кроки квізу (generateStaticParams)

**Files:**
- Create: `src/app/onboarding/[step]/layout.tsx`

**Interfaces:**
- Consumes: `STEPS` з `@/lib/onboarding/steps` (масив `Step` з полем `key: string`).
- Produces: усі відомі кроки пререндеряться при build (SSG). `dynamicParams` лишається дефолтним `true`: невідомий ключ рендериться динамічно, і клієнтський редірект у StepRenderer веде на перший незаповнений крок (НЕ 404).

- [ ] **Step 1: Створити layout зі static params**

`src/app/onboarding/[step]/layout.tsx`:

```tsx
import { STEPS } from '@/lib/onboarding/steps';

// Кроки квізу — статичний HTML при build: швидкий TTFB на вході у воронку,
// CDN-кешованість, миттєвий prefetch між кроками (див. StepRenderer).
// dynamicParams лишаємо true: сміттєвий ключ обробляє клієнтський редірект
// у StepRenderer (firstUnansweredKey), а не 404.
export function generateStaticParams() {
  return STEPS.map((s) => ({ step: s.key }));
}

export default function OnboardingStepLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

- [ ] **Step 2: Тип-чек**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Перевірити на build, що кроки статичні**

Переконатися, що dev-сервер зупинений. Run: `npm run build 2>&1 | grep -A2 "onboarding"`
Expected: `/onboarding/[step]` з переліком згенерованих шляхів (`/onboarding/gender`, `/onboarding/main_goal`, …) і позначкою `●` (SSG). Якщо позначка `ƒ` — щось у page/layout тягне динамічні API; зупинитись і розібратися (див. superpowers:systematic-debugging), НЕ комітити.

- [ ] **Step 4: Commit**

```bash
git add src/app/onboarding/[step]/layout.tsx
git commit -m "perf(onboarding): prerender all quiz steps via generateStaticParams

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: StepRenderer — prefetch сусідніх кроків + предекод у дві хвилі

**Files:**
- Modify: `src/components/onboarding/StepRenderer.tsx`

**Interfaces:**
- Consumes: `router.prefetch` (next/navigation), `nextStepKey`/`prevStepKey` з engine, `STEPS`, `EXPERTS`.
- Produces: нічого нового назовні; змінюється лише внутрішня поведінка ефектів.

- [ ] **Step 1: Додати імпорт типу Step**

До імпортів додати:

```ts
import type { Step } from '@/lib/onboarding/types';
```

- [ ] **Step 2: Замінити ефект предекодування**

Знайти блок (рядки ~56–71 — коментар «Предекодування всіх картинок квізу…» разом з useEffect) і замінити на:

```ts
  // Предекодування картинок у ДВІ хвилі, щоб не конкурувати з LCP першого
  // екрана: одразу — лише поточний крок + 2 наступні; решту (включно з фото
  // експертів) — в idle. AVIF не вискакує посеред анімації появи кроку,
  // а на back-навігації малюється одразу з кешу.
  useEffect(() => {
    const idx = STEPS.findIndex((s) => s.key === stepKey);
    if (idx !== -1) {
      decodeImages(STEPS.slice(idx, idx + 3).flatMap(stepImageSrcs));
    }
    if (fullPredecodeDone) return;
    fullPredecodeDone = true;
    const decodeRest = () => {
      decodeImages([
        ...STEPS.flatMap(stepImageSrcs),
        ...EXPERTS.map((e) => e.photo),
      ]);
    };
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(decodeRest, { timeout: 2500 });
    } else {
      setTimeout(decodeRest, 2500);
    }
  }, [stepKey]);
```

- [ ] **Step 3: Додати модульні хелпери**

Після рядка `const trackedStepViews = new Set<string>();` додати:

```ts
// Повний предекод (хвиля 2) запускається один раз за сесію.
let fullPredecodeDone = false;
// Браузер дедуплікує повторні запити по кешу, тож повторні виклики дешеві.
const decodedSrcs = new Set<string>();

function stepImageSrcs(s: Step): string[] {
  return [
    s.image?.src,
    s.headerImage?.src,
    ...(s.options ?? []).map((o) => o.image),
    ...Object.values(s.variants ?? {}).map((v) => v.image?.src),
  ].filter((src): src is string => Boolean(src));
}

function decodeImages(srcs: string[]): void {
  for (const src of srcs) {
    if (decodedSrcs.has(src)) continue;
    decodedSrcs.add(src);
    const img = new Image();
    img.src = src;
    img.decode?.().catch(() => {});
  }
}
```

Примітка: поля `options[].image` та `variants` можуть бути відсутні в типі `Step` у такому вигляді — звірити точні назви полів із наявним кодом ефекту, який видаляється (він уже читає `s.image?.src`, `s.headerImage?.src`, `s.options`, `s.variants`) — сигнатури скопіювати звідти дослівно.

- [ ] **Step 4: Додати ефект prefetch сусідніх кроків**

Після ефекту з `onboarding_step_view` (рядки ~85–90) додати:

```ts
  // Prefetch RSC-payload сусідніх кроків: router.push без <Link> сам нічого
  // не префетчить, тож без цього кожен перехід чекає мережевий запит.
  // next залежить від відповіді на ПОТОЧНОМУ кроці, тому для розгалужених
  // кроків це прогноз по поточних answers — влучає в основний шлях.
  useEffect(() => {
    if (!ready || !accessible) return;
    const next = nextStepKey(stepKey, answers);
    const prev = prevStepKey(stepKey, answers);
    if (next) router.prefetch(`/onboarding/${next}`);
    if (prev) router.prefetch(`/onboarding/${prev}`);
  }, [ready, accessible, stepKey, answers, router]);
```

- [ ] **Step 5: Тип-чек**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Ручна перевірка у dev**

Запустити `npm run dev` (порт має бути вільний), відкрити `http://localhost:3000/onboarding`:
- редірект на `/onboarding/gender`, крок рендериться;
- у Network: одразу — лише картинки перших кроків (women/men.avif тощо), решта AVIF — за ~2.5 с;
- відповісти на 2–3 кроки: переходи працюють, назад — теж, у Network видно prefetch-запити RSC сусідніх кроків.
Зупинити dev-сервер.

- [ ] **Step 7: Commit**

```bash
git add src/components/onboarding/StepRenderer.tsx
git commit -m "perf(onboarding): prefetch adjacent steps, two-wave image predecode

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Стиснення важких AVIF квізу

**Files:**
- Create: `scripts/compress-onboarding-images.mjs`
- Modify (binary): `public/onboarding/*.avif` (лише файли > 60 КБ)

**Interfaces:** нема — одноразовий скрипт, комітиться для повторного використання.

- [ ] **Step 1: Створити скрипт**

`scripts/compress-onboarding-images.mjs`:

```js
// Одноразове стиснення картинок квізу: ресайз до ширини <= 960px (колонка
// квізу <= 480px, х2 на retina) + AVIF quality 50. Перезаписує файл лише
// якщо результат менший. Запуск: node scripts/compress-onboarding-images.mjs
import sharp from 'sharp';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = 'public/onboarding';
const THRESHOLD_BYTES = 60 * 1024;
const MAX_WIDTH = 960;

const files = (await readdir(DIR)).filter((f) => f.endsWith('.avif'));
let saved = 0;

for (const file of files) {
  const filePath = path.join(DIR, file);
  const before = (await stat(filePath)).size;
  if (before <= THRESHOLD_BYTES) {
    console.log(`skip  ${file} (${Math.round(before / 1024)}K)`);
    continue;
  }
  const out = await sharp(await readFile(filePath))
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .avif({ quality: 50 })
    .toBuffer();
  if (out.length >= before) {
    console.log(`keep  ${file}: recompressed not smaller`);
    continue;
  }
  await writeFile(filePath, out);
  saved += before - out.length;
  console.log(
    `write ${file}: ${Math.round(before / 1024)}K -> ${Math.round(out.length / 1024)}K`,
  );
}

console.log(`total saved: ${Math.round(saved / 1024)}K`);
```

- [ ] **Step 2: Запустити**

Run: `node scripts/compress-onboarding-images.mjs`
Expected: `write ...` для breakfast/kollaz/women-before-after-1/dinner/lunch/expert/women-before-after/men-before-after/men-before-after-2 (усі > 60 КБ); `total saved` ≥ 500K.

- [ ] **Step 3: Візуальний контроль**

Переглянути (інструментом Read, він рендерить картинки) щонайменше три найсильніше стиснуті файли: `public/onboarding/breakfast.avif`, `public/onboarding/kollaz.avif`, `public/onboarding/women-before-after-1.avif`.
Expected: без явних артефактів (бандинг, «мило» на обличчях). Якщо файл виглядає погано — відновити його `git checkout -- public/onboarding/<file>` і перезапустити скрипт для нього з `quality: 60` (тимчасова правка), потім повернути скрипту 50.

- [ ] **Step 4: Зафіксувати розміри**

Run: `du -sh public/onboarding && du -ah public/onboarding | sort -rh | head -10`
Expected: сумарно ~0.6–0.8M (було 1.5M).

- [ ] **Step 5: Commit**

```bash
git add scripts/compress-onboarding-images.mjs public/onboarding
git commit -m "perf(onboarding): compress quiz AVIF images to <=960px width

~1.5MB -> ~0.7MB; додано reusable-скрипт стиснення.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: ExampleWorkSection — priority лише першому слайду

**Files:**
- Modify: `src/components/MainPage/section-exampleWork/ExampleWorkSection.tsx`

**Interfaces:** нема — зміна пропів next/image всередині компонента.

- [ ] **Step 1: Додати index у map і виправити пропи Image**

Рядок `{workExamples.map((work) => (` замінити на `{workExamples.map((work, index) => (`.

Блок `<Image ... priority />` (рядки ~142–149) замінити на:

```tsx
                        <Image
                          src={work.image}
                          alt={work.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1152px) 50vw, 576px"
                          className="object-contain md:rounded-xl"
                          // Високий пріоритет — лише видимому першому слайду.
                          // Решта: eager без пріоритету (lazy не спрацює —
                          // зсунуті translateX слайди не перетинають viewport).
                          priority={index === 0}
                          loading={index === 0 ? undefined : 'eager'}
                        />
```

- [ ] **Step 2: Тип-чек**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/MainPage/section-exampleWork/ExampleWorkSection.tsx
git commit -m "perf(landing): high fetch priority only for the first slider image

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: /payment/plan — знижка з куки на сервері, FAQ без гідрації

**Files:**
- Modify: `src/lib/discount.ts`
- Create: `src/lib/discount.test.ts`
- Create: `src/components/payment/FaqSection.tsx`
- Create: `src/components/payment/PlanPageClient.tsx` (перенесення з page.tsx)
- Modify: `src/app/payment/plan/page.tsx` (стає серверним)

**Interfaces:**
- Produces: `discountUntilFromValue(raw: string | undefined): number | null` у `@/lib/discount`; `PlanPageClient({ initialDiscount, faq }: { initialDiscount: DiscountState; faq: React.ReactNode })` і `export type DiscountState = { active: boolean; until: number | null }` у `@/components/payment/PlanPageClient`; `FaqSection()` (серверний, без пропів) у `@/components/payment/FaqSection`.
- Consumes: `DISCOUNT_COOKIE`, `isDiscountActive` з `@/lib/discount`; `cookies()` з `next/headers`.

- [ ] **Step 1: Написати тест для discountUntilFromValue**

`src/lib/discount.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { discountUntilFromValue } from './discount';

describe('discountUntilFromValue', () => {
  it('parses a positive integer timestamp', () => {
    expect(discountUntilFromValue('1719700000000')).toBe(1719700000000);
  });

  it.each([
    ['undefined', undefined],
    ['empty string', ''],
    ['not a number', 'abc'],
    ['zero', '0'],
    ['negative', '-5'],
  ])('returns null for %s', (_label, raw) => {
    expect(discountUntilFromValue(raw)).toBeNull();
  });
});
```

- [ ] **Step 2: Запустити — має впасти**

Run: `npm test -- src/lib/discount.test.ts`
Expected: FAIL — `discountUntilFromValue` не експортується.

- [ ] **Step 3: Додати хелпер у `src/lib/discount.ts`**

Замінити `discountUntilFromCookie` на пару функцій (решта файлу без змін):

```ts
/** Парсинг сирого значення куки: server components читають cookies() напряму. */
export function discountUntilFromValue(raw: string | undefined): number | null {
  const until = Number(raw);
  return Number.isFinite(until) && until > 0 ? until : null;
}

export function discountUntilFromCookie(req: NextRequest): number | null {
  return discountUntilFromValue(req.cookies.get(DISCOUNT_COOKIE)?.value);
}
```

- [ ] **Step 4: Тести проходять**

Run: `npm test -- src/lib/discount.test.ts`
Expected: PASS.

- [ ] **Step 5: Створити серверний FaqSection**

`src/components/payment/FaqSection.tsx` (БЕЗ `'use client'`; акордеон — нативні details/summary, нуль гідраційного JS; `name="faq"` дає ексклюзивне відкриття в сучасних браузерах, у старих просто дозволені кілька відкритих):

```tsx
import { ChevronDown } from 'lucide-react';

const FAQ_ITEMS = [
  {
    question: 'Як цей план може допомогти мені схуднути?',
    answer:
      'Сервіс складає індивідуальне меню під ваші дані та ціль, підтримуючи м’який дефіцит калорій — без голодувань і жорстких обмежень. Ви бачите калорійність і баланс білків, жирів та вуглеводів кожної страви, а система щодня відстежує ваш прогрес відносно цілі. Такий послідовний режим харчування дає стабільний результат у схудненні.',
  },
  {
    question: 'Що робити, якщо я швидко втрачу мотивацію?',
    answer:
      'Ми подбали про легкі нагадування, поради експертів та зручні інструменти відстеження — серії успішних днів, трекери води й ваги. Ви щодня бачите свій прогрес, а коли результат помітний, залишатися послідовними значно легше. Так ви досягнете своїх цілей і насолоджуватиметеся більш підтягнутим, здоровим тілом, не боячись здатися.',
  },
  {
    question: 'Як я отримаю доступ до свого плану?',
    answer:
      'Після здійснення покупки ви отримаєте магічне посилання на вказану електронну пошту. Після переходу по посиланню вас перенесе в особистий кабінет. Все вже налаштовано. Ми будемо супроводжувати та підтримувати вас протягом усього процесу.',
  },
];

// Серверний компонент: акордеон на <details>/<summary> — без клієнтського JS.
export function FaqSection() {
  return (
    <section>
      <h2 className="mb-3 text-center font-heading text-[30px] font-bold md:text-[35px] xl:text-[44px]">
        Люди часто запитують
      </h2>
      <div className="flex flex-col divide-y divide-ink/10 dark:divide-night-ink/10">
        {FAQ_ITEMS.map((item) => (
          <details key={item.question} name="faq" className="group">
            <summary className="flex w-full cursor-pointer list-none items-center justify-between gap-3 py-4 text-left font-heading text-[20px] font-bold transition-colors hover:text-sage-dark md:text-[24px] dark:hover:text-sage-light [&::-webkit-details-marker]:hidden">
              {item.question}
              <ChevronDown className="h-6 w-6 flex-shrink-0 text-ink/40 transition-transform group-open:rotate-180 dark:text-night-muted" />
            </summary>
            <p className="pb-4 text-lg leading-relaxed text-ink/70 dark:text-night-ink/70">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
```

Примітка: якщо `npx tsc --noEmit` скаржиться на атрибут `name` у `<details>` (React 19 типи його вже знають; якщо ні) — замінити `name="faq"` на `{...{ name: 'faq' }}`.

- [ ] **Step 6: Створити PlanPageClient перенесенням**

```bash
git mv src/app/payment/plan/page.tsx src/components/payment/PlanPageClient.tsx
```

Потім у `src/components/payment/PlanPageClient.tsx` зробити такі точкові правки:

1. Перший рядок-коментар `// app/payment/plan/page.tsx` замінити на:
```tsx
// Клієнтська частина /payment/plan. Стан знижки приходить із сервера
// (кука читається в page.tsx) — без клієнтського fetch('/api/discount').
```
2. Видалити з імпортів `ChevronDown` (використовувався лише у FAQ).
3. Видалити повністю: константу `FAQ_ITEMS` і функцію `FaqSection()` (вони переїхали у `FaqSection.tsx`).
4. Рядок `type DiscountState = { active: boolean; until: number | null };` замінити на:
```tsx
export type DiscountState = { active: boolean; until: number | null };
```
5. Сигнатуру компонента замінити з:
```tsx
export default function DashboardPage() {
```
на:
```tsx
export function PlanPageClient({
  initialDiscount,
  faq,
}: {
  initialDiscount: DiscountState;
  faq: React.ReactNode;
}) {
```
6. Стан знижки: рядки
```tsx
  const [discount, setDiscount] = useState<DiscountState | null>(null);
```
замінити на:
```tsx
  const [discount, setDiscount] = useState<DiscountState>(initialDiscount);
```
7. У головному `useEffect` видалити блок fetch знижки (разом із коментарем):
```tsx
    fetch('/api/discount')
      .then((res) => (res.ok ? res.json() : null))
      .then((s: DiscountState | null) => {
        if (!cancelled) setDiscount(s ?? { active: false, until: null });
      })
      .catch(() => !cancelled && setDiscount({ active: false, until: null }));
```
Також видалити коментар над станом «Вікно знижки: джерело правди — httpOnly-кука (GET /api/discount); тут лише відображення таймера. Ціну оплати сервер рахує сам.» і замінити на:
```tsx
  // Вікно знижки: initialDiscount прочитано з httpOnly-куки на сервері
  // (page.tsx); тут лише тик таймера. Ціну оплати сервер рахує сам.
```
8. `discount` більше не буває null — прибрати null-перевірки:
   - `discount?.active` → `discount.active` (у ефекті секундного тику, у `remainingMs`, у `discountActive`, в ефекті «Таймер дійшов нуля»);
   - у `renderPlansSection`: умову
     ```tsx
     {discount !== null && !discountActive && discount.until === null ? (
     ```
     замінити на
     ```tsx
     {!discountActive && discount.until === null ? (
     ```
   - у стікі-хедері: умову
     ```tsx
     {discount !== null &&
       discount.until !== null &&
     ```
     замінити на
     ```tsx
     {discount.until !== null &&
     ```
   - `discountActive` рядок `const discountActive = discount?.active === true && remainingMs > 0;` → `const discountActive = discount.active && remainingMs > 0;`
9. Виклик `<FaqSection />` замінити на `{faq}`.
10. Видалити з JSX блок футера (він переїжджає в серверний page.tsx):
```tsx
      {/* Міні-футер у стилі лендінгового Footer */}
      <footer className="bg-sage-dark py-6 text-card/60">
        ...увесь блок до </footer> включно...
      </footer>
```

- [ ] **Step 7: Створити новий серверний page.tsx**

`src/app/payment/plan/page.tsx` (новий файл):

```tsx
// Серверна обгортка /payment/plan: читає httpOnly-куку знижки, щоб таймер і
// ціни були в першому HTML без клієнтського fetch. Читання cookies() робить
// роут динамічним — прийнятно: без походів у БД TTFB мінімальний.
import { cookies } from 'next/headers';
import Link from 'next/link';
import {
  DISCOUNT_COOKIE,
  discountUntilFromValue,
  isDiscountActive,
} from '@/lib/discount';
import { PlanPageClient } from '@/components/payment/PlanPageClient';
import { FaqSection } from '@/components/payment/FaqSection';

export default async function PlanPage() {
  const store = await cookies();
  const until = discountUntilFromValue(store.get(DISCOUNT_COOKIE)?.value);

  return (
    <>
      <PlanPageClient
        initialDiscount={{ active: isDiscountActive(until), until }}
        faq={<FaqSection />}
      />

      {/* Міні-футер у стилі лендінгового Footer */}
      <footer className="bg-sage-dark py-6 text-card/60">
        <div className="div-container mx-auto flex flex-col items-center gap-2 text-center text-xs md:flex-row md:justify-between md:text-left">
          <span>© {new Date().getFullYear()} Sytno. Усі права захищені.</span>
          <Link
            href="/oferta"
            className="underline-offset-4 transition-colors hover:text-card hover:underline"
          >
            Публічна оферта (умови, ФОП, повернення)
          </Link>
        </div>
      </footer>
    </>
  );
}
```

Якщо після перенесення в PlanPageClient імпорт `Link` більше не використовується (перевірити: `Link` вживається ще в посиланні на /payment/surprise у `renderPlansSection`) — залишити як є; якщо ESLint скаржиться на невикористаний імпорт — видалити.

- [ ] **Step 8: Тип-чек, тести, лінт**

Run: `npx tsc --noEmit && npm test && npm run lint`
Expected: усе exit 0 (лінт може лаятись лише на давні файли, не на змінені).

- [ ] **Step 9: Ручна перевірка у dev**

Запустити `npm run dev`, відкрити `http://localhost:3000/payment/plan`:
- сторінка рендериться, картки планів, email, слайдер, відгуки на місці;
- FAQ відкривається/закривається (details), відкриття одного пункту закриває інший (Chrome);
- без куки: банер «🎁 На тебе чекає сюрприз…» видимий, таймера в хедері нема;
- пройти `/payment/surprise` (скретч) → повернутись на /payment/plan: таймер у хедері йде ОДРАЗУ при завантаженні (без затримки на fetch), ціни зі знижкою і перекресленими повними;
- у Network НЕМАЄ запиту `/api/discount` зі сторінки /payment/plan.
Зупинити dev-сервер.

- [ ] **Step 10: Commit**

```bash
git add src/lib/discount.ts src/lib/discount.test.ts src/components/payment/FaqSection.tsx src/components/payment/PlanPageClient.tsx src/app/payment/plan/page.tsx
git commit -m "perf(payment): server-read discount cookie, static FAQ without hydration

/payment/plan: таймер і ціни в першому HTML, мінус fetch /api/discount;
FAQ на <details> — нуль клієнтського JS.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Фінальна верифікація і порівняння з базлайном

**Files:**
- Delete: `build-baseline.txt` (наприкінці)

**Interfaces:**
- Consumes: `build-baseline.txt` з Task 0.

- [ ] **Step 1: Повний прогін перевірок**

Переконатися, що dev-сервер зупинений. Run: `npx tsc --noEmit && npm test && npm run build 2>&1 | tee build-after.txt`
Expected: усе exit 0.

- [ ] **Step 2: Порівняти з базлайном**

Порівняти `build-baseline.txt` і `build-after.txt`:
- First Load JS shared: очікуване зменшення ~55–65 КБ (posthog-js поза бандлом);
- `/onboarding/[step]`: був `ƒ`, став `●` зі списком кроків;
- `/payment/plan`: був `○`, став `ƒ` (кука — очікувано);
- `du -sh public/onboarding`: ~0.6–0.8M проти 1.5M.

- [ ] **Step 3: Смоук-тест на production-збірці**

Run: `npm run start` (у фоні), потім пройти руками:
- `/onboarding` → редірект на перший крок, квіз проходиться до кінця (з відповідями), переходи миттєві;
- `/payment/plan` — усе з Task 9 Step 9;
- лендінг `/` — слайдер працює, перший слайд чіткий одразу;
- `curl -s -o /dev/null -D - http://localhost:3000/onboarding/women.avif | grep -i cache-control` → immutable.
Зупинити сервер.

- [ ] **Step 4: Прибрати артефакти і закомітити підсумок**

```bash
rm build-baseline.txt build-after.txt
git status
```
Expected: робоче дерево чисте (усі зміни закомічені в Tasks 1–9). Якщо лишились правки — розібратися, звідки вони, перш ніж комітити.

- [ ] **Step 5: Підсумкове звірення зі спекою**

Пройтись по розділах спеки 1–7 і підтвердити, що кожен реалізований відповідним комітом. Повідомити користувачу порівняльні цифри (First Load JS, розміри картинок, статуси роутів).
