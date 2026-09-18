# Інтеграція списку покупок із кошиком Сільпо (Silpo MCP)

**Дата:** 2026-09-18
**Статус:** затверджено користувачем (варіант «Замовити в Сільпо» з превʼю)

## Мета

Юзер Sytno, підключивши свій акаунт Сільпо один раз, натискає на сторінці
`/shopping-list` кнопку «Замовити в Сільпо», бачить превʼю підібраних товарів з
цінами і сумою під свій список, підтверджує, і товари опиняються в його кошику
Сільпо для магазину/адреси в його місті. Оформлення (слот, оплата) він завершує
на сайті або в застосунку Сільпо за посиланням.

## Факти про Silpo MCP (перевірено наживо 2026-09-18)

- Ендпоінт `https://mcp.silpo.ua/mcp`, Streamable HTTP, JSON-RPC 2.0. Сесійний
  заголовок `Mcp-Session-Id` сервер не повертає, кожен `tools/call` самодостатній
  з `Authorization: Bearer`.
- Авторизація лише від імені юзера: OAuth 2.1 + PKCE (S256), юзер логіниться на
  `auth.silpo.ua` (телефон + OTP). Метадані: `/.well-known/oauth-authorization-server`
  (authorize `/authorize`, token `/token`, revoke `/token`, DCR `/register`).
  Публічний клієнт (`token_endpoint_auth_method: none`) приймається; localhost і
  довільний https redirect приймаються. Без токена сервер віддає 401 навіть на
  `initialize`.
- Токен: `expires_in = 2 592 000` с (30 днів), `refresh_token` є, grant
  `refresh_token` підтримується.
- Пошук товарів `silpo_find_products_batch(branchId, deliveryType, timeslotStart,
  timeslotEnd, products[≤30], limit)` прив'язаний до філії і **таймслоту**. З
  простроченим слотом повертає `success:true` і 0 товарів без помилки. Це головна
  пастка: перед пошуком завжди брати актуальний слот через
  `silpo_get_time_slots(branchId, deliveryTypes, start=now)`.
- Продукт у відповіді: `id, name, slug, price, oldPrice, stock, available, image,
  weighted, step, displayRatio ("800г" | "100г" | "10шт" | "шт"), companyId,
  branchId, externalProductId`. Для вагових (`weighted: true`) `step` і
  `quantity` завжди в кілограмах.
- Додавання: `silpo_add_or_update_cart_products(shoppingCartId, products[{productId,
  companyId, branchId, quantity}])`, без `addQuantity` кількість ЗАМІНЮЄТЬСЯ. Після
  цього обов'язково `silpo_get_shopping_cart_by_id` для `validations[]`,
  `calculation.totalAfterDiscounts`, `checkoutWebLink`, `checkoutMobileLink`.
- «Місто» = адреса/філія в кошику Сільпо. Існуючий кошик: `silpo_get_my_shopping_cart`
  → `silpo_get_shopping_cart_by_id` (`cart.shipments[0].branchId`, `cart.deliveryType`,
  `cart.address.city`). Новий кошик: `silpo_find_address(текст)` →
  `silpo_get_available_delivery_types(lat,lng)` → для SelfPickup
  `silpo_list_branches(hasPickup=true)` і вибір найближчої → `silpo_get_time_slots`
  → `silpo_create_shopping_cart`.
- Якість матчингу «перший результат» недостатня: «кисломолочний сир» → дитячий
  сирок, «лосось» → копчені черевця, «помідори» → чері асорті. Потрібне
  ранжування кандидатів.
- Юридично: AI Factory це хакатон, комерційної оферти немає, контакт
  `mcp@silpo.club`. Сервіс може змінитись або зникнути, тому інтеграція має бути
  ізольованою і вимикатись без наслідків для решти застосунку.

## Межі (що НЕ робимо)

- Не оформлюємо замовлення й не проводимо оплату всередині Sytno.
- Не синхронізуємо статус «куплено» з замовленнями Сільпо; галочки ставить юзер.
- Не кешуємо каталог Сільпо, не показуємо ціни у списку постійно.
- Не підтримуємо доставку Новою Поштою (лише DeliveryHome / SelfPickup).
- Не чіпаємо бонуси, купони, сертифікати, промокоди.
- Не змінюємо `shoppingListBuilder`, формат `ShoppingListItem` і API
  `/api/shopping-list` (крім читання).

## Архітектура

Усе спілкування з Сільпо йде з сервера Next.js. Клієнт бачить лише наші API.
Один новий каталог `src/lib/silpo/` з ізольованими модулями, кожен з однією
відповідальністю:

| Модуль | Робить | Залежить від |
|---|---|---|
| `oauth.ts` | PKCE (verifier/challenge/state), URL авторизації, обмін коду, refresh, revoke. Чисті fetch до `https://mcp.silpo.ua`. | env `SILPO_MCP_CLIENT_ID`, `NEXT_PUBLIC_APP_URL` |
| `crypto.ts` | `encrypt(text)` / `decrypt(payload)` AES-256-GCM, ключ з env `SILPO_TOKEN_ENC_KEY` (32 байти, base64). | node:crypto |
| `connections.ts` | Репозиторій колекції `silpo_connections`: `getConnection(userEmail)`, `saveTokens`, `deleteConnection`, `markExpired`. Колекція `silpo_oauth_states` для pending-станів (TTL 10 хв). | `getDb`, `crypto.ts` |
| `client.ts` | `callTool<T>(userEmail, name, args)`: бере токен, якщо `expiresAt - 5 хв < now` → refresh; POST JSON-RPC `tools/call`; парсить `content[0].text` як JSON; при 401 один раз рефрешить і повторює, при повторному 401 → `markExpired` і кидає `SilpoAuthError`; 429 → `SilpoRateLimitError`; `isError` → `SilpoToolError(text)`. | `connections.ts`, `oauth.ts` |
| `cartContext.ts` | `resolveCartContext(userEmail)` → `{ kind: 'ready', cartId, branchId, companyId, deliveryType, timeslot, address: {city, street} }` або `{ kind: 'no-cart' }`. Завжди перевіряє слот: `get_time_slots(start=now, limit=40)`, бере перший `available`; якщо слот кошика не серед доступних → `update_shopping_cart({ timeslot })`. | `client.ts` |
| `setupCart.ts` | `lookupDeliveryOptions(userEmail, addressText)` → `{ address, options: [{deliveryType:'DeliveryHome'|'SelfPickup', branchId, branchLabel?}] }` (для SelfPickup бере найближчу філію з `list_branches(hasPickup)` за гаверсинусом); `createCart(userEmail, address, option)` → перший доступний слот → `create_shopping_cart` (для SelfPickup `addressType:'self-pickup'`, координати філії; для DeliveryHome `addressType:'house'`, координати адреси). | `client.ts` |
| `quantity.ts` | Чисті функції: `parseDisplayRatio("800г") → { amount: 800, unit: 'g' }` (г/кг/мл/л/шт, «0,5кг», «шт» без числа = 1 шт); `toBaseUnits(quantity, unit)` для наших одиниць (г, кг, мл, л, шт, ст.л.=15 мл/г, ч.л.=5, скл.=250 мл, пучок/зубчик/щіпка → `null`); `computeQuantity(item, product) → { quantity, approximate }`: вагові → кг, округлення вгору до кратного `step`, мінімум `step`; штучні → `ceil(needed / perPack)`, мінімум 1; невідомі одиниці → 1 і `approximate: true`; кап за `stock`. | нічого |
| `matchProducts.ts` | `matchShoppingItems(userEmail, items, ctx, profile)` → чанками по 30 `find_products_batch(limit 6)`; для кожного айтема з ≥1 кандидатом один виклик `gpt-4.1-mini` на весь чанк (JSON: `{ itemId → { productId | null, reason } }`) з правилами: базовий продукт, а не бренд-екзотика чи дитяче харчування; без інгредієнтів із `allergies`/`dislikedFoods`; для вагових і поштучних однаково; якщо жоден кандидат не відповідає → `null`. Потім `computeQuantity`. Результат: `SilpoMatch[]` з обраним товаром, альтернативами (решта кандидатів), кількістю, сумою. Якщо LLM недоступний → фолбек «перший available кандидат». | `client.ts`, `quantity.ts`, OpenAI (окремий клієнт як у `parseCustomFood.ts`) |
| `types.ts` | `SilpoConnection`, `SilpoProduct`, `SilpoCartContext`, `SilpoMatch`, `SilpoAddResult`, класи помилок. | |

Мінімальний MCP-клієнт власний, без `@modelcontextprotocol/sdk`: потрібен один
метод `tools/call` через fetch, що підтверджено пробою.

## Дані (MongoDB)

`silpo_connections` (унікальний індекс `userEmail`):

```
{ userEmail, accessTokenEnc, refreshTokenEnc, expiresAt: Date, scope,
  status: 'active' | 'expired', connectedAt, updatedAt }
```

`silpo_oauth_states` (TTL-індекс `createdAt` 600 с):

```
{ state, verifierEnc, userEmail, returnTo, createdAt }
```

Токени і verifier зберігаються тільки зашифрованими. Нічого з Сільпо (товари,
матчі) не персистимо: превʼю живе у стані компонента.

## API (усі вимагають `readSessionUserId()`, інакше 401)

| Маршрут | Вхід | Вихід |
|---|---|---|
| `GET /api/silpo/connect?returnTo=/shopping-list` | | 302 на `authorize` URL; створює state |
| `GET /api/silpo/callback?code&state` | | обмін коду, збереження, 302 на `returnTo?silpo=connected`; при помилці 302 на `returnTo?silpo=error` |
| `GET /api/silpo/status` | | `{ connected, status, cart: { city, street, deliveryType } \| null }` (cart без виклику слотів, лише `get_my_shopping_cart` + `get_shopping_cart_by_id`) |
| `DELETE /api/silpo/connection` | | best-effort revoke, видалення документа, `{ success }` |
| `POST /api/silpo/cart/options` | `{ address }` | результат `lookupDeliveryOptions` |
| `POST /api/silpo/cart/create` | `{ address, deliveryType, branchId }` | `{ cart: {city, street, deliveryType} }` |
| `POST /api/silpo/match` | `{ items: [{ itemId, quantity }] }` (id з активного списку юзера; `quantity` = кількість, показана в поточному фільтрі, бо сервер не знає обраний період) | `{ matches: SilpoMatch[], unmatched: [{itemId, name}], total, context: { city, deliveryType, minOrderCost } }` або `{ error: 'no-cart' }` |
| `POST /api/silpo/cart/add` | `{ products: [{productId, companyId, branchId, quantity}] }` | `{ totalAfterDiscounts, minOrderCost, validations: [{level, message, context}], checkoutWebLink, checkoutMobileLink }` |

`returnTo` дозволяємо тільки з білого списку `/shopping-list`, `/profile`.
`items[].itemId` перевіряємо на приналежність списку юзера, назву й одиницю
беремо з БД, а не з клієнта; `quantity > 0`. `products[]` валідуємо як uuid +
`quantity > 0`.

## Потоки

**Підключення.** Профіль → «Підключити Сільпо» → `GET /api/silpo/connect` →
auth.silpo.ua (телефон + OTP) → `callback` → зберігаємо → повертаємось з тостом
«Сільпо підключено». Те саме з тізера на `/shopping-list`.

**Замовлення.** Кнопка «Замовити в Сільпо» видима лише коли `connected` і є
некуплені айтеми в поточному фільтрі (Пн–Ср / Чт–Нд / весь тиждень).
1. Відкривається `SilpoOrderSheet`, викликає `POST /api/silpo/match` з парами
   `{ itemId, quantity }` для видимих некуплених айтемів, де `quantity` це
   значення `displayQuantity(item, filter)` поточного фільтра.
2. `no-cart` → крок «Адреса»: поле «Місто, вулиця, будинок» → `cart/options` →
   радіо «Доставка додому» / «Самовивіз: {філія}» → `cart/create` → повтор match.
3. Превʼю: список карток (картинка, назва товару Сільпо, фасування, `кількість ×
   ціна = сума`, під ним «для: {наш інгредієнт}»), чекбокс вибору, «Замінити» з
   випадним списком альтернатив (уже отримані кандидати, без нових запитів),
   степер ± для кількості упаковок (для вагових крок = `step` кг), позначка «≈»
   якщо `approximate`, блок «Не знайшли» з назвами. Футер: «Разом ≈ {сума} ₴»,
   мін. замовлення, і кнопка «Додати в кошик Сільпо ({n})».
4. `cart/add` → результат: сума до оплати, попередження з `validations`
   (`product.offer.stock.max` → «{товар}: доступно лише {stock}», мін. сума →
   «Мінімальне замовлення {minOrderCost} ₴»), кнопки «Оформити на сайті» /
   «Оформити в застосунку» (`target=_blank`). Наш список не змінюємо.

## UI-компоненти

- `src/components/profilePage/SilpoConnectSettings.tsx`: секція «🛒 Сільпо» між
  «Застосунок» і «Незабаром». Стани: не підключено (текст + кнопка terracotta),
  підключено (бейдж sage «Підключено», рядок адреси кошика, «Відключити» з
  підтвердженням), `expired` («Сесія Сільпо закінчилась» + «Підключити знову»).
- `src/components/shoppingListPage/SilpoOrderButton.tsx`: під прогрес-баром;
  підключено → кнопка «🛒 Замовити в Сільпо»; не підключено → тихий рядок-тізер
  «Замовити продукти в Сільпо → Підключити».
- `src/components/shoppingListPage/SilpoOrderSheet.tsx` на базі `BottomSheet`:
  кроки `address | loading | preview | adding | done | error`.
- `src/hooks/useSilpoConnection.ts`: `GET /api/silpo/status` один раз, стан
  `connected/status/cart`, `refresh()`. Читає `?silpo=connected|error` з URL
  для тосту і чистить параметр.
- Стиль: бренд-токени (sage/terracotta/cream, `rounded-2xl`, `shadow-soft`),
  без orange. Лого Сільпо не використовуємо до письмової згоди, лише текст.

## Помилки

| Ситуація | Поведінка |
|---|---|
| Refresh не вдався / 401 двічі | `status: 'expired'`, sheet показує «Підключіть Сільпо знову» з кнопкою |
| 429 | «Сільпо тимчасово перевантажене, спробуйте за хвилину» |
| 0 кандидатів для айтема | у «Не знайшли» |
| LLM недоступний | фолбек на першого available кандидата, сheet показує позначку «підбір спрощений» |
| Немає доступних слотів для філії | «Магазин зараз не приймає замовлення, спробуйте пізніше» |
| `create_shopping_cart` не вдалось | показ тексту помилки тулу, повернення на крок адреси |
| Мережа Сільпо недоступна (timeout 20 с) | загальна помилка з «Спробувати знову»; решта застосунку не залежить |

## Безпека

- Токени лише на сервері, зашифровані AES-256-GCM; `state` одноразовий, TTL 10 хв,
  прив'язаний до `userEmail`.
- Жодних викликів Сільпо з клієнта; ключі `SILPO_MCP_CLIENT_ID`,
  `SILPO_TOKEN_ENC_KEY` без `NEXT_PUBLIC_`.
- `client_id` реєструється один раз на середовище скриптом
  `scripts/silpo-register-client.mjs` (DCR з `redirect_uris = [APP_URL/api/silpo/callback]`),
  значення кладеться в env. Dev: уже зареєстрований `KK9l9ouVJm5rjMvA` для
  `http://localhost:3000/api/silpo/callback`.
- Записи в кошик Сільпо лише за явним натисканням «Додати в кошик»; оновлення
  таймслоту кошика виконується автоматично, бо без нього пошук порожній, і юзер
  все одно обирає слот при оформленні.

## Аналітика

Через фасад `src/lib/analytics/`: `silpo_connected`, `silpo_disconnected`,
`silpo_match_requested {items}`, `silpo_match_result {matched, unmatched}`,
`silpo_cart_added {products, total}`.

## Тестування

- Vitest: `quantity.ts` (парсинг displayRatio, конверсії, кратність step, кап за
  stock, невідомі одиниці); `matchProducts.ts` з мокнутими `callTool` і OpenAI
  (вибір, фолбек, unmatched); `cartContext.ts` з моками (стар. слот → update,
  no-cart); `oauth.ts` (PKCE S256 відповідає RFC 7636 тест-вектору).
- `npx tsc --noEmit` (не `next build` під час dev).
- Ручний e2e на dev-клієнті з акаунтом користувача: підключення, match для
  реального списку, додавання 2–3 товарів у кошик, перевірка у застосунку Сільпо.

## Ризики

- Сервіс без комерційної оферти: лист у `mcp@silpo.club` надіслано паралельно
  (див. `docs/silpo/SUPPORT_EMAIL_DRAFT.md`). Фіча за флагом присутності
  `SILPO_MCP_CLIENT_ID`: без нього секції й кнопки не рендеряться.
- Некалібровані одиниці інгредієнтів (баг 2.2) дають приблизну кількість; у
  превʼю показуємо «≈» і даємо змогу змінити кількість степером ±.
