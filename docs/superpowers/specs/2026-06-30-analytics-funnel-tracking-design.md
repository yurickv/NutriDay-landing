# Аналітика воронки та атрибуція джерел — дизайн

**Дата:** 2026-06-30
**Статус:** затверджено (дизайн, уточнено після грилінг-сесії), готується план реалізації
**Ревізія 2026-06-30:** дизайн стрес-тестовано. Дельти: розд. 3 (явні прапорці PostHog),
розд. 4 (мікро-події плати-сторінки + клієнтський `payment_succeeded` у Фазі 1, `plan_selected`
→ сегмент), розд. 6 (роздвоєння identity: PostHog чистий email / GA4 `sha256`), розд. 7
(іменовані процесори, `person_profiles=always`), розд. 8 (три середовища), розд. 9 (фази).
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
Instagram / партнер (UTM-лінк) → завжди на «/»
   └─ Лендінг /                       [$pageview, utm_* → nd_attribution]
        └─ /onboarding (~16 кроків,    [onboarding_started, $pageview на кожен крок,
           розгалужений)                onboarding_completed на ОСТАННЬОМУ кроці]
             └─ /payment/plan          [payment_email_entered, payment_consents_checked;
                                        plan_selected — лише сегмент]
                  └─ onPay()           [checkout_started + identify(email) | checkout_blocked]
                       └─ /api/subscription/init → /api/liqpay/checkout
                            └─ редірект на LiqPay  [redirected_to_liqpay]  ← далі клієнта не бачимо
                                 └─ LiqPay (зовнішній домен)
                                      ├─ редірект назад → /payment/result
                                      │     [payment_succeeded(КЛІЄНТ, Фаза 1) + re-identify, GA4 purchase]
                                      └─ /api/liqpay/callback (СЕРВЕР, Фаза 2)
                                            [payment_succeeded | payment_failed]  ← авторитет, дедуп orderId
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
   - `identify` РОЗДВОЮЄТЬСЯ: PostHog → `identify(email)` (чистий email); GA4 →
     `gtag('set', { user_id: sha256(email) })`. **Email у GA4 не передаємо ніде** (політика
     Google щодо PII). Деталі — розділ 6.

2. **`src/components/analytics/AnalyticsProvider.tsx`** (новий, client component) —
   ініціалізує `posthog-js` і GA4 (gtag через `next/script`); **сам ловить pageview на
   зміну роуту** (App Router не робить автоматично) через `usePathname()` +
   `useSearchParams()`. Також на першому заході зчитує `utm_*` і пише в `localStorage`
   (розділ 5). Монтується один раз у `src/app/layout.tsx`.
   - PostHog init (явні прапорці, «воронки-only»): `disable_session_recording: true`,
     **`autocapture: false`** (не роздуваємо ліміт 1M і не ловимо email-інпут через DOM),
     **`capture_pageview: false`** (pageview робимо вручну тут же — інакше подвійний рахунок),
     `person_profiles: 'always'` (потрібен анонімний верх воронки — розділ 7). На email-інпуті
     `/payment/plan` додаємо клас `ph-no-capture` як додатковий запобіжник.

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
безкоштовно. Додаємо семантичні віхи на межах конверсії. **Виняток — плати-сторінка:**
вона критична і вміщає план+email+згоди+оплату в одному екрані, тож на ній додаємо пасивні
мікро-події прогресу (груба «дійшов / не оплатив» не каже, ДЕ саме застряг).

| Подія | Де спрацьовує | Props | Навіщо |
|---|---|---|---|
| `$pageview` (ручний) | `AnalyticsProvider`, кожен роут | `path`, `utm_*` | Перегляд кожної сторінки/кроку |
| `onboarding_started` | вхід у `/onboarding` | `utm_source` | Вхід у воронку |
| `onboarding_completed` | **останній крок онбордингу** (не маунт `/payment/plan`) | — | Пройшов опитувальник |
| `payment_email_entered` | `/payment/plan`, blur/debounce коли email валідний | — | Дійшов до email на платі |
| `payment_consents_checked` | `/payment/plan`, коли обидві згоди виставлені | — | Готовий до оплати |
| `checkout_started` | `onPay()` після валідних email+згоди | `plan`, `amount` | Намір платити + точка `identify(email)` |
| `checkout_blocked` | `onPay()` коли валідація впала | `reason: no_consent\|invalid_email` | Чому застряг перед оплатою |
| `redirected_to_liqpay` | перед `form.submit()` → LiqPay | `plan`, `orderId` | Пішов на платіжку |
| `payment_succeeded` (КЛІЄНТ) | `/payment/result`, коли статус резолвиться в paid (Фаза 1) | `plan`, `amount`, `currency`, `utm_source`, `orderId` | Закриває воронку без чекання сервера; + re-`identify` |
| `payment_succeeded` (СЕРВЕР) | `liqpay/callback`+`consume` (Фаза 2) | `plan`, `amount`, `currency`, `utm_source`, `orderId` | Авторитетна оплата (дедуп за `orderId`) |
| `payment_failed` | `/payment/result` (клієнт) + **сервер** `liqpay/callback` | `status` | Невдала оплата |
| `login_completed` | `/auth/confirm` після consume | — | Активація доступу + повторний `identify` |

> `plan_selected` (`plan: week\|month`) — **лише сегмент/проп, НЕ крок воронки:** план `week`
> передвибраний за замовчуванням, тож подія систематично недораховує тих, хто приймає дефолт.
> Для «який план чіпляє» дивимось розподіл, а не конверсію.

**Головна воронка в PostHog (повна вже у Фазі 1 завдяки клієнтському `payment_succeeded`):**
`$pageview /` → `onboarding_started` → `onboarding_completed` → `payment_email_entered`
→ `payment_consents_checked` → `checkout_started` → `redirected_to_liqpay`
→ `payment_succeeded` → `login_completed`

**Як читаються розриви:**
- `onboarding_completed` без `payment_email_entered` → подивився на план/ціну і пішов, не
  ввівши email (страх ціни / роздум).
- `payment_email_entered` без `payment_consents_checked` → застряг на згодах.
- `payment_consents_checked` без `checkout_started` (або `checkout_blocked`) → валідаційний/
  технічний затик (а `reason` каже точно: немає згоди / некоректний email).
- `checkout_started` без `redirected_to_liqpay` → помилка API `init`/`checkout`.
- `redirected_to_liqpay` без `payment_succeeded` → відвалився/невдача **на самій LiqPay**
  (або оплатив, але не повернувся на `/payment/result` — клієнт-vs-сервер розрив у Фазі 2
  показує саме цю частку).

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

**Роздвоєння identify (PostHog ≠ GA4):**
- **PostHog** → `identify(email)` — чистий email як `distinct_id` (легше звіряти з БД).
- **GA4** → `gtag('set', { user_id: sha256(email.trim().toLowerCase()) })` — **псевдонімний
  хеш**, бо Google забороняє PII у `user_id`/полях (ризик видалення даних / блокування
  property). Email у GA4-події не кладемо взагалі. Хеш детермінований → склейка працює.

**Точки `identify`:**
1. `checkout_started` (у `onPay()`, коли email валідний) → найраніший надійний момент:
   PostHog зливає анонімний шлях у людину-email.
2. `payment_succeeded` на `/payment/result` (Фаза 1) → повторний `identify(email)` перед
   клієнтською подією оплати (на випадок, якщо webview перезапускався після LiqPay).
3. `login_completed` (`/auth/confirm` після consume) → `identify(email)` ще раз (magic-link
   могли відкрити в іншому браузері/девайсі).
4. `resetIdentity()` на логауті (щоб не змішувати людей на спільному пристрої).

*PII-нота:* email як distinct_id — це PII лише в PostHog (приватність не критична → лишаємо
чистий email, простіше звіряти з БД). GA4 натомість отримує **тільки хеш** — див. вище.

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
GA4 отримує `purchase` **клієнтськи на `/payment/result`** (стандарт для маркетингу/ROAS).
PostHog на тій самій сторінці отримує клієнтський `payment_succeeded` (Фаза 1), а серверний
(Фаза 2) лишається авторитетним через дедуп за `orderId`. Measurement Protocol (серверний
GA4) — Фаза 3, якщо зʼявиться недооблік конверсій.

---

## 7. Згода / приватність

- **Без блокуючого cookie-банера** на старті — аналітика вантажиться одразу (відповідає
  «швидко»). Аудиторія переважно укр.; на `/payment/plan` уже є згода на обробку перс.
  даних + оферта.
- **У політику/оферту — іменований перелік процесорів і трансфер:** обробляємо email (PII)
  і передаємо в **PostHog (EU)** та **Google/GA4 (US-трансфер)**. Прописуємо саме процесорів
  і факт передачі за кордон, а не загальне «використовуємо аналітику».
- **`disable_session_recording: true` + `autocapture: false`** — «воронки-only»: менший
  обсяг, менше приватнісних питань, дешевше (про прапорці — розділ 3).
- **`person_profiles: 'always'` лишаємо.** `identified_only` НЕ вмикаємо: він відв'язує
  анонімні pageview (лендінг → онбординг до `identify`) від персони і **ламає верх воронки** —
  саме той, де міряємо «куди дійшов / де відвалився ДО плати-сторінки». Це **не** «легкий
  важіль здешевлення». Якщо впремося в ліміт 1M — ріжемо обсяг інакше (autocapture вже off).
- **Google Consent Mode v2 — відкладено.** Поки аудиторія UA — не потрібен. Тригер на
  впровадження: поява скільки-небудь **ЄС-трафіку** (орієнтовно ~жовтень 2026 / ЄС-партнер),
  бо без згоди ad-дані з ЄС у GA4 деградують.

---

## 8. Перевірка (verification)

- **Три середовища (знімає суперечність «консоль vs Live Events»):**
  - **local (без ENV-ключів)** → `track()` лише в консоль, нуль мережі;
  - **staging (ключі окремого dev-PostHog-проєкту + GA4 `debug_mode`)** → **реальні
    відправки**; саме тут ганяємо e2e-чек-лист по *Live Events*, не засмічуючи прод;
  - **prod** → бойовий проєкт.
- **Кожна подія несе проп `env` (`local|staging|prod`)** — щоб відфільтрувати, якщо щось
  протече не в той проєкт.
- **Серверна подія оплати без реального вебхука:** локально перевіряємо лише гілку
  реконсиляції `magic-link/consume` (LiqPay не б'є на `localhost`). Гілку `liqpay/callback`
  валідуємо **на staging** із sandbox LiqPay. Заразом перевіряємо, що подвійна активація
  (callback + consume) **не подвоює** `payment_succeeded` завдяки дедупу за `orderId`.
- **Чек-лист e2e (staging):** пройти воронку → у PostHog *Live Events* всі події з
  `distinct_id = email`; `identify` злив анонімний шлях; клієнтська (Фаза 1) і серверна
  (Фаза 2) `payment_succeeded` не дублюються; працює розбивка за `utm_source`.
- Памʼятка репо: не запускати `next build` поки активний `next dev`; типи перевіряємо
  `npx tsc --noEmit`.

---

## 9. Фази впровадження

- **Фаза 1 (ядро, повна воронка):** `analytics.ts` фан-аут (`track` + роздвоєний `identify`:
  PostHog чистий email / GA4 `sha256`) + `AnalyticsProvider` (ручні pageview; `autocapture:false`,
  `capture_pageview:false`, `disable_session_recording:true`, `person_profiles:'always'`) + ENV
  + клієнтські події воронки (`onboarding_started`, `onboarding_completed` на останньому кроці
  онбордингу, `payment_email_entered`, `payment_consents_checked`, `checkout_started/blocked`,
  `redirected_to_liqpay`, `login_completed`) + **клієнтський `payment_succeeded` на
  `/payment/result`** (+ re-identify) + GA4 `purchase` клієнтськи + UTM-персист у localStorage
  (`nd_attribution`) + проп `env` у всіх подіях. `plan_selected` — лише сегмент.
- **Фаза 2 (надійна оплата):** `posthog.server.ts` (`posthog-node` + `await flush()`), серверні
  `payment_succeeded/failed` у `callback`+`consume` (авторитетні, дедуп за `orderId`), поля
  атрибуції (`utmSource/Medium/Campaign`) у `users` через `init`.
- **Фаза 3 (опц., потім):** GA4 Measurement Protocol, session replay, A/B через feature flags,
  Google Consent Mode v2 (коли з'явиться ЄС-трафік).
- **Налаштування в UI (без коду):** зібрати воронку + дашборд у PostHog, цілі в GA4.

---

## 10. Критерій готовності

- **Уже після Фази 1** у PostHog видно повну конверсію `лендінг → onboarding → план
  (email/consents) → checkout → оплата → логін` з розбивкою **Instagram vs партнер**, і
  однозначно видно, де відвалюються перед оплатою (клієнтський `payment_succeeded` закриває
  воронку без чекання серверної частини).
- Фаза 2 додає **авторитетну** серверну оплату (дедуп за `orderId`) і атрибуцію в `users`.
- У GA4 — джерела трафіку + purchases.

---

## Дотичні файли

- `src/lib/analytics.ts` (розширити)
- `src/components/analytics/AnalyticsProvider.tsx` (новий)
- `src/lib/analytics/posthog.server.ts` (новий)
- `src/app/layout.tsx` (підключити provider)
- `src/app/onboarding/**` (`onboarding_started`; `onboarding_completed` на ОСТАННЬОМУ кроці,
  не на маунті `/payment/plan` — інакше повторні платники хибно «завершують онбординг»)
- `src/app/payment/plan/page.tsx` (`payment_email_entered`, `payment_consents_checked`,
  `checkout_started`/`_blocked`, `redirected_to_liqpay`, `identify`; `plan_selected` як проп;
  клас `ph-no-capture` на email-інпуті)
- `src/app/api/subscription/init/route.ts` (зберегти UTM у `users`)
- `src/app/api/liqpay/callback/route.ts` (серверні події оплати)
- `src/app/api/auth/magic-link/consume/route.ts` (подія оплати на реконсиляції + точка `login_completed`)
- `src/app/payment/result/page.tsx` (клієнтський `payment_succeeded` у PostHog + re-identify
  + GA4 `purchase`; дедуп за `orderId` спільний із серверною подією Фази 2)
- `src/app/auth/confirm/page.tsx` (`login_completed`, `identify`)
- `.env` (ключі PostHog/GA)
