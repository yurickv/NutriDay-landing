# Аналітика воронки та атрибуція джерел — дизайн

**Дата:** 2026-06-30
**Статус:** затверджено (дизайн), готується план реалізації
**Контекст:** сайт у продакшні, трафік іде з Instagram і партнерського сайту. Потрібно
відстежувати джерела трафіку, шлях користувача по сторінках (зокрема ~16-кроковий
onboarding) і де саме він зупиняється перед оплатою.

---

## 1. Мета та вимоги

Відповісти на три питання:

1. **Звідки прийшов** — Instagram vs партнерський сайт (атрибуція джерел).
2. **Куди дійшов** — шлях по сторінках, у т.ч. покроковий onboarding.
3. **Де зупинився перед оплатою** — на якому кроці воронки відвалюється.

**Пріоритети користувача:** глибина аналізу + дешево + швидко. Приватність/контроль
даних — **не** в пріоритеті.

**Рішення про інструмент:** **PostHog Cloud (EU) + GA4 паралельно.**
- PostHog — «мозок» продуктових воронок і drop-off аналізу (безкоштовно до 1M подій/міс).
- GA4 — маркетингова атрибуція й заділ під Google Ads.
- Власний сервіс аналітики **відкинуто**: дешевий лише на хостингу, але найдорожчий
  за часом і дає найгіршу глибину на старті — суперечить «швидко/дешево».

---

## 2. Воронка NutriDay (модель «оплата до логіну»)

```
Instagram / партнер (UTM-лінк)
   └─ Лендінг /                       [$pageview, utm_*]
        └─ /onboarding (~16 кроків)    [onboarding_started, $pageview на кожен крок]
             └─ /payment/plan          [onboarding_completed, plan_selected]
                  └─ onPay()           [checkout_started + identify(email) | checkout_blocked]
                       └─ /api/subscription/init → /api/liqpay/checkout
                            └─ редірект на LiqPay  [redirected_to_liqpay]  ← далі клієнта не бачимо
                                 └─ LiqPay (зовнішній домен)
                                      └─ /api/liqpay/callback (сервер)  [payment_succeeded | payment_failed]
                                           └─ magic-link email → /auth/confirm → consume  [login_completed]
                                                └─ /menu
```

**Ключовий нюанс:** оплата відбувається **до** створення сесії. Email стає відомий
уже на `/payment/plan` (метод `onPay`) — і на клієнті, і на сервері (`init`/`checkout`/
`callback`). Це дозволяє «склеїти» анонімний шлях із конкретною людиною ще до логіну.

---

## 3. Архітектура та підключення

**Принцип:** один виклик `track()` → фан-аут у обидва провайдери. Жоден компонент не
знає про PostHog/GA4 напряму — лише про нашу абстракцію (ізольовані, тестовані юніти).

**Компоненти:**

1. **`src/lib/analytics.ts`** (розширюємо наявний) — єдина точка входу.
   - `track(event, props)` всередині викликає `posthog.capture()` і `window.gtag('event', …)`.
   - Додаємо `identify(email)` і `resetIdentity()`.
   - Тип `AnalyticsEvent` доповнюємо подіями воронки (розділ 4).
   - Лишається SSR-safe (`typeof window === 'undefined'` guard).
   - GA4-маппінг при фан-ауті: `checkout_started` → `begin_checkout`,
     `payment_succeeded` → `purchase` (з `value`/`currency`). Решта — під власними іменами.

2. **`src/components/analytics/AnalyticsProvider.tsx`** (новий, client component) —
   ініціалізує `posthog-js` і GA4 (gtag через `next/script`); **сам ловить pageview на
   зміну роуту** (App Router не робить автоматично) через `usePathname()` +
   `useSearchParams()`. Також на першому заході зчитує `utm_*` і пише в `localStorage`
   (розділ 5). Монтується один раз у `src/app/layout.tsx`.
   - PostHog init: `disable_session_recording: true` (обрано «воронки-only»).

3. **`src/lib/analytics/posthog.server.ts`** (новий) — серверний клієнт `posthog-node`
   для надійних подій оплати з колбеку (розділ 6).

**ENV (`.env`):**
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST` = `https://eu.posthog.com` (EU-регіон)
- `NEXT_PUBLIC_GA_ID` = `G-…`
- `POSTHOG_API_KEY` — той самий project key для `posthog-node` на сервері.

**Потік даних:**
```
Компонент / роут ─ track('event', props) ─► posthog.capture() ─► PostHog Cloud (EU)
                                          └► gtag('event', …)  ─► GA4
AnalyticsProvider (зміна роуту) ─► $pageview / page_view ──────► обидва
liqpay/callback (сервер) ─► posthog-node capture ─────────────► PostHog (надійна оплата)
```

---

## 4. Події воронки (taxonomy)

**YAGNI:** pageview по роутах уже дає покроковий перегляд усіх кроків onboarding
безкоштовно. Додаємо лише семантичні віхи на межах конверсії.

| Подія | Де спрацьовує | Props | Навіщо |
|---|---|---|---|
| `$pageview` (авто) | `AnalyticsProvider`, кожен роут | `path`, `utm_*` | Перегляд кожної сторінки/кроку |
| `onboarding_started` | вхід у `/onboarding` | `utm_source` | Вхід у воронку |
| `onboarding_completed` | дійшов до `/payment/plan` | — | Пройшов опитувальник |
| `plan_selected` | вибір тарифу в `payment/plan/page.tsx` | `plan: week\|month` | Який план чіпляє |
| `checkout_started` | `onPay()` після валідних email+згоди | `plan`, `amount` | Намір платити + точка `identify(email)` |
| `checkout_blocked` | `onPay()` коли валідація впала | `reason: no_consent\|invalid_email` | Чому застряг перед оплатою |
| `redirected_to_liqpay` | перед `form.submit()` → LiqPay | `plan`, `orderId` | Пішов на платіжку |
| `payment_succeeded` | **сервер** `liqpay/callback` | `plan`, `amount`, `currency`, `utm_source` | Надійна подія оплати |
| `payment_failed` | **сервер** `liqpay/callback` | `status` | Невдала оплата |
| `login_completed` | `/auth/confirm` після consume | — | Активація доступу |

**Головна воронка в PostHog:**
`$pageview /` → `onboarding_started` → `onboarding_completed` → `checkout_started`
→ `redirected_to_liqpay` → `payment_succeeded` → `login_completed`

**Як читаються розриви:**
- `onboarding_completed` без `checkout_started` → кинув на сторінці плану/email
  (а `checkout_blocked` каже чому: немає згоди / некоректний email).
- `checkout_started` без `redirected_to_liqpay` → помилка API `init`/`checkout`.
- `redirected_to_liqpay` без `payment_succeeded` → відвалився/невдача **на самій LiqPay**.

**Наявні in-app події** (`menu_generated`, `water_logged`, …) лишаються як є — просто
тепер реально відправляються, а не no-op.

---

## 5. Атрибуція джерел (UTM)

**Базис — єдина UTM-конвенція** (документована, команда тегує всі лінки):

| Канал | URL |
|---|---|
| Instagram bio | `…/?utm_source=instagram&utm_medium=social&utm_campaign=bio` |
| Instagram stories | `…&utm_source=instagram&utm_medium=social&utm_campaign=stories` |
| Instagram пост | `…&utm_campaign=post&utm_content=<дата/тема>` |
| Партнерський сайт | `…?utm_source=partner&utm_medium=referral&utm_campaign=<назва_партнера>` |

**Як ловиться (без зайвого коду):**
- **PostHog** `posthog-js` сам парсить `utm_*` → `$initial_utm_source` (first-touch, на
  рівні людини) + у кожну подію. Розбивка воронки за `utm_source` — з коробки.
- **GA4** автоматично визначає джерело сесії з тих самих `utm_*`.

**Стійкість через довгу воронку** (перетинає редірект на LiqPay і клік magic-link з
імейлу — можливо інший таб/девайс → новий анонімний id):
1. `identify(email)` на `checkout_started` зшиває анонімний шлях із людиною; PostHog
   зливає first-touch UTM на цю людину. Розбивка воронки за джерелом працює на рівні
   **людини** — тож навіть серверна `payment_succeeded` лягає в потрібне джерело.
2. **Додатково (дешево й надійно):** на першому заході `AnalyticsProvider` читає `utm_*`
   з URL і пише в `localStorage` `nd_attribution` (first-touch wins). На
   `/api/subscription/init` ці поля летять у запис `users` (`utmSource`/`utmMedium`/
   `utmCampaign`). Так джерело осідає **і в нашій БД**, і серверна подія оплати несе
   `utm_source` явно — незалежно від cookie/сесій.

**Чому обидва механізми:** PostHog person-merge дає миттєві воронки в UI; власний
localStorage+DB дає стійкість (магік-лінк з іншого девайсу) і власні дані для звітів
поза PostHog.

---

## 6. Identity-склейка + серверні події оплати

**Єдиний `distinct_id` = email.** Email — канонічний ідентифікатор (`readSessionUserId()`
повертає email, колбек теж оперує email). Усі події — клієнтські й серверні — летять на
одну людину за email.

**Точки `identify`:**
1. `checkout_started` (у `onPay()`, коли email валідний) → `identify(email)`. Найраніший
   надійний момент: PostHog зливає анонімний шлях у людину-email; GA4 отримує `user_id`.
2. `login_completed` (`/auth/confirm` після consume) → `identify(email)` ще раз (magic-link
   могли відкрити в іншому браузері).
3. `resetIdentity()` на логауті (щоб не змішувати людей на спільному пристрої).

*PII-нота:* email як distinct_id — це PII в PostHog. Приватність не критична → лишаємо
чистий email (простіше звіряти з БД). Опція: захешувати (наразі не робимо).

**Серверні події оплати** (`src/lib/analytics/posthog.server.ts`, `posthog-node`):
- У `liqpay/callback`, у блоці активації — `capture({ distinctId: email, event:
  'payment_succeeded', properties: { plan, amount, currency, utm_source } })`. `utm_source`
  беремо із запису `users` (покладено на `init`). Аналогічно `payment_failed`.
- Спрацьовує **лише на переході** `previousPaymentStatus !== 'active'` — той самий guard,
  що вже стереже відправку magic-link → без дублів на ретраях LiqPay (вони ще й
  відсікаються унікальним індексом `payment_events.signature`).
- Друга гілка активації — реконсиляція в `magic-link/consume` (для local/sandbox без
  колбеку): там теж фаємо подію на переході в `active`.
- **Дедуп за `orderId`** як insert-id — щоб навіть подвійна гілка (callback + consume) не
  подвоїла лічильник.
- **Serverless-нюанс:** route handler короткоживучий → після `capture` робимо
  `await client.flush()`, інакше подія не встигне відправитись.

**GA4 і оплата:** GA4 для серверних подій потребує `_ga` client_id (зайвий клопіт). Тому
GA4 отримує `purchase` **клієнтськи на `/payment/result`** (стандарт для маркетингу/ROAS),
а PostHog — надійну серверну. Measurement Protocol (серверний GA4) — Phase 3, якщо
зʼявиться недооблік конверсій.

---

## 7. Згода / приватність

- **Без блокуючого cookie-банера** на старті — аналітика вантажиться одразу (відповідає
  «швидко»). Аудиторія переважно укр.; на `/payment/plan` уже є згода на обробку перс.
  даних + оферта. Додамо лише рядок про використання PostHog/GA в оферті/політиці.
- **`disable_session_recording: true`** у PostHog — обрано «воронки-only»: менший обсяг
  подій, менше приватнісних питань, дешевше.
- Опція на майбутнє: `person_profiles: 'identified_only'` здешевлює при рості трафіку.
  За замовчуванням — багатша атрибуція; вмикаємо при наближенні до ліміту.

---

## 8. Перевірка (verification)

- **Окремий PostHog-проєкт для dev/staging**, щоб не засмічувати продакшн-воронку.
  У dev `track()` логує в консоль; реальні відправки — лише коли є ENV-ключі. GA4 — через
  DebugView (`debug_mode`).
- **Чек-лист e2e (у sandbox):** пройти воронку → у PostHog *Live Events* зʼявляються всі
  події з `distinct_id = email`; `identify` злив анонімний шлях; серверна
  `payment_succeeded` прийшла; працює розбивка за `utm_source`.
- Памʼятка репо: не запускати `next build` поки активний `next dev`; типи перевіряємо
  `npx tsc --noEmit`.

---

## 9. Фази впровадження

- **Фаза 1 (ядро):** `analytics.ts` фан-аут + `AnalyticsProvider` (pageviews) + ENV +
  `identify` + клієнтські події воронки (`onboarding_started/completed`, `plan_selected`,
  `checkout_started/blocked`, `redirected_to_liqpay`, `login_completed`) + UTM-персист у
  localStorage + GA4 `purchase` клієнтськи.
- **Фаза 2 (надійна оплата):** `posthog.server.ts`, серверні `payment_succeeded/failed` у
  `callback`+`consume`, поля атрибуції в `users`.
- **Фаза 3 (опц., потім):** GA4 Measurement Protocol, session replay, A/B через feature flags.
- **Налаштування в UI (без коду):** зібрати воронку + дашборд у PostHog, цілі в GA4.

---

## 10. Критерій готовності

- У PostHog видно конверсію `лендінг → onboarding → план → checkout → оплата → логін`
  з розбивкою **Instagram vs партнер**, і однозначно видно, де відвалюються перед оплатою.
- У GA4 — джерела трафіку + purchases.

---

## Дотичні файли

- `src/lib/analytics.ts` (розширити)
- `src/components/analytics/AnalyticsProvider.tsx` (новий)
- `src/lib/analytics/posthog.server.ts` (новий)
- `src/app/layout.tsx` (підключити provider)
- `src/app/onboarding/**` (`onboarding_started`/`_completed`)
- `src/app/payment/plan/page.tsx` (`plan_selected`, `checkout_started`/`_blocked`,
  `redirected_to_liqpay`, `identify`)
- `src/app/api/subscription/init/route.ts` (зберегти UTM у `users`)
- `src/app/api/liqpay/callback/route.ts` (серверні події оплати)
- `src/app/api/auth/magic-link/consume/route.ts` (подія оплати на реконсиляції + точка `login_completed`)
- `src/app/payment/result/page.tsx` (GA4 `purchase` клієнтськи)
- `src/app/auth/confirm/page.tsx` (`login_completed`, `identify`)
- `.env` (ключі PostHog/GA)
