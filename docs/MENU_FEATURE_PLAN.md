# EasyMenu — План розробки: Тижневе меню, Список покупок та PWA

> **Статус**: Фаза 1 ✅ | Фаза 2 ✅ | Фаза 3 ✅ | Фаза 4 ✅ | Фаза 5 ✅ | Власні страви ✅ | Масштабованість & безпека ✅ | OWASP-аудит ✅ | Промпт v2 ✅ | UI Redesign ✅ | Фаза 6–7 — в черзі
> **Пріоритет**: Висока
> **Ціль**: Побудувати персоналізований кабінет для схуднення з AI-меню, списком покупок та елементами залучення, оптимізований для мобільних (PWA).

---

## Загальний опис

Після проходження онбордингу (вага, зріст, вік, стать, рівень активності, цілі) користувач потрапляє до кабінету `/menu`. OpenAI генерує персоналізоване тижневе меню на основі його даних і зберігає в MongoDB. Додаток є PWA і призначений переважно для жінок, що хочуть схуднути, використовуючи смартфон.

**Ключові принципи**:
- Рецепти та меню генерує OpenAI — ніякої преднаповненої бази рецептів
- Всі виклики OpenAI — тільки через серверну сторону (env-ключ не розкривається клієнту)
- Безпечний підхід до схуднення: без негативного фреймінгу, min 1200 ккал/день
- Відстеження прогресу ваги — ключовий мотиватор для цільової аудиторії

---

## Моделі даних MongoDB

### `user_profiles` — розширений профіль користувача

```js
{
  userEmail: string,           // FK до users.email (сесійний ключ)

  // Біометрія (з онбордингу):
  weight: number,              // кг (початкова)
  height: number,              // см
  age: number,
  sex: "female" | "male",
  activityLevel: string,       // "1.2" | "1.375" | ... | "1.9"

  // Цілі (з онбордингу):
  mainGoal: string,
  shortGoals: string[],
  additionalGoals: string[],

  // Розраховані (формула буде надана):
  bmr: number,                 // ккал/день базовий метаболізм
  tdee: number,                // ккал/день з урахуванням активності
  goalCalories: number,        // цільова калорійність (min 1200 для жінок)

  // Харчові переваги (керує користувач):
  favoriteFoods: string[],     // враховує LLM при генерації
  dislikedFoods: string[],     // виключає LLM при генерації
  dietaryPreferences: string[],// ["без глютену", "вегетаріанське", ...]
  allergies: string[],         // ["горіхи", "молоко", ...]
  waterGoalMl: number,         // default 2000

  updatedAt: Date
}
```
**Індекс**: `{ userEmail: 1 }` (unique)

---

### `weekly_menus` — AI-згенерований план

```js
{
  _id: ObjectId,
  userEmail: string,
  weekStartDate: Date,              // Понеділок 00:00 UTC
  goalCaloriesAtGeneration: number,
  aiModel: string,                  // "gpt-4o" (для аудиту)
  status: "active" | "archived",
  days: [
    {
      date: Date,
      dayLabel: string,             // "Понеділок"
      meals: {
        breakfast: AIMeal,
        lunch: AIMeal,
        dinner: AIMeal,
        snacks: AIMeal[]
      },
      totalCalories: number,
      totalPrepMinutes: number,     // сума prepTime всіх страв дня
      isCompleted: boolean,         // auto-true коли ≥3 прийомів (меню + власні) consumed
      completedAt: Date | null,
      customEntries: CustomEntry[]  // власні з'їдені страви поза меню (LLM/ручний ввід)
    }
  ],
  createdAt: Date,
  updatedAt: Date,
  archivedAt: Date | null    // ставиться при status:"archived" → драйвер TTL-видалення (60 днів)
}
```

**AIMeal** (повністю вбудований, без посилань):
```js
{
  name: string,                     // "Вівсяна каша з ягодами"
  calories: number,                 // ккал на порцію
  protein: number,                  // г
  fat: number,                      // г
  carbs: number,                    // г
  servingSize: number,              // г (1 порція)
  servings: number,                 // кількість порцій (default 1, змінюється юзером)
  emoji: string,                    // "🥣"
  description: string,              // рецепт + кроки приготування (UA)
  ingredients: [
    {
      name: string,
      quantity: number,             // для servings=1
      unit: string,                 // "г" | "мл" | "шт" | "ч.л." | ...
      shoppingCategory: ShoppingCategory
    }
  ],
  prepTimeMinutes: number,
  cookTimeMinutes: number,
  isMultiDayPrep: boolean,         // true для борщу, рагу тощо
  multiDayPrepDays: number,        // 2 або 3
  difficulty: "easy" | "medium" | "hard",
  isSwapped: boolean,
  originalMealSnapshot: AIMeal | null,
  quickAlternatives: AIMeal[],     // ліниво генеруються на запит (GET /api/menu/meal/alternatives)

  // Трекінг споживання:
  isConsumed: boolean,             // чи з'їла
  consumedAt: Date | null,

  // Зворотній зв'язок:
  rating: 1 | 2 | 3 | null,       // 😍=3 / 😐=2 / 👎=1
  ratedAt: Date | null
}
```

**CustomEntry** (власна з'їдена страва, `src/types/meals.ts`):
```js
{
  id: string,                       // UUID (серверний)
  name: string,
  emoji: string,
  calories: number,                 // АБСОЛЮТНІ, за фактично з'їдену вагу
  protein: number,
  fat: number,
  carbs: number,
  grams: number | null,             // фактична вага порції
  per100: { calories, protein, fat, carbs } | null,  // склад на 100 г — для re-scale у формі
  source: "ai" | "manual",
  createdAt: Date
}
```

**Індекси** (див. `src/lib/ensureIndexes.ts` — єдине джерело правди): `{ userEmail: 1, status: 1, createdAt: -1 }` (вибірка активного меню) + TTL `{ archivedAt: 1 }` `expireAfterSeconds: 60 днів`.

> **Важливо**: Окремої колекції `meals` немає — страви вбудовані в `weekly_menus`. При перегенерації старий документ архівується (`status:"archived"` + `archivedAt`), новий зберігається. Архівні авто-видаляються через TTL за 60 днів; активні поля `archivedAt` не мають, тож TTL їх не чіпає.

---

### `shopping_lists`

```js
{
  _id: ObjectId,
  userEmail: string,
  weeklyMenuId: ObjectId,
  weekStartDate: Date,
  items: [
    {
      id: string,                   // UUID
      name: string,
      quantity: number,             // сумарно за тиждень (у `unit`)
      quantityByDay: number[],      // розбивка по днях тижня, [0]=Пн…[6]=Нд; сума підмножини = коректний період. [] для ручних товарів
      unit: string,
      shoppingCategory: ShoppingCategory,
      mealNames: string[],
      forDays: string[],            // ["Понеділок", "Вівторок"] — лейбли днів для відображення
      isPurchased: boolean,
      purchasedAt: Date | null,     // для conflict resolution при офлайн-синхронізації
      isCustom: boolean
    }
  ],
  updatedAt: Date
}
```

`ShoppingCategory`: `"vegetables" | "fruits" | "meat" | "fish" | "dairy" | "grains" | "legumes" | "oils" | "spices" | "other"`

**Індекс**: `{ userEmail: 1, weekStartDate: -1 }`. При генерації нового меню старі списки видаляються (`deleteMany({ userEmail })`) — у користувача лишається лише поточний. Список — **похідний снапшот меню**: ре-синкається при свопі страви (`buildShoppingList` + `mergeShoppingItems`) і самовідновлюється в `GET` (добудова `quantityByDay` для legacy-списків). Суми по періодах (Пн–Ср / Чт–Нд) рахуються з `quantityByDay` за **індексом дня**, не за лейблом.

---

### `weight_logs` — НОВА колекція

```js
{
  _id: ObjectId,
  userEmail: string,
  date: Date,             // день зважування (midnight UTC)
  weight: number,         // кг
  note: string | null,    // "після свят", "після тренування"
  createdAt: Date
}
```

**Індекс**: `{ userEmail: 1, date: -1 }`

> **UX правило**: Нагадування зважуватись 1 раз на тиждень (не щодня — уникати нездорової фіксації). Показувати тижневий/місячний тренд, не щоденні коливання.

---

### `favorite_meals` — НОВА колекція

```js
{
  _id: ObjectId,
  userEmail: string,
  meal: AIMeal,           // повний snapshot страви
  savedAt: Date,
  timesGenerated: number  // скільки разів AI генерував цю страву
}
```

**Індекс**: `{ userEmail: 1, savedAt: -1 }`

---

### `user_streaks`

```js
{
  userEmail: string,
  currentStreak: number,
  longestStreak: number,
  lastCheckedDate: Date,
  totalDaysCompleted: number,
  badges: [{ id: string, earnedAt: Date }]
  // Бейджі: "streak_3", "streak_7", "streak_14", "streak_30", "streak_60", "streak_100"
}
```

---

### `tips` — база лайфхаків (засівається один раз)

```js
{
  text: string,
  category: "nutrition" | "hydration" | "motivation" | "cooking" | "lifestyle",
  tags: string[],
  isActive: boolean,
  displayWeight: number   // 1-10, для зваженого вибору
}
```

---

### `push_subscriptions`

```js
{
  userEmail: string,
  endpoint: string,
  keys: { p256dh: string, auth: string },
  mealReminderTimes: { breakfast: string, lunch: string, dinner: string },
  isActive: boolean
}
```

---

### `water_logs` (append-only)

```js
// Один документ на КОЖНУ залогіновану порцію. Раніше був один документ на день
// із масивом logs[] (ріс безмежно через $push) — змінено на append-only.
// Денний обсяг = $sum по (userEmail, date); goalMl береться з user_profiles.
{
  userEmail: string,
  date: Date,             // midnight UTC
  amountMl: number,       // обсяг саме цієї порції
  loggedAt: Date
}
```
**Індекс**: `{ userEmail: 1, date: 1 }`

---

## OpenAI інтеграція

### `src/lib/menu/generateMenuWithAI.ts`

**Вхідні дані**: `UserProfile` + поточний місяць (для сезонності) + рейтинги минулих страв

**Промпт (system)**:
- Роль: дієтолог-нутриціолог
- Мова відповіді: українська
- Формат: валідний JSON (схема нижче)
- Правила: збалансоване харчування для схуднення, різноманітність, реальні страви

**Промпт (user)**:
```
Склади 7-денне меню (сніданок, обід, вечеря, 1 перекус) для:
Стать: {sex}, Вік: {age}, Вага: {weight}кг, Зріст: {height}см
Цільова калорійність: ~{goalCalories} ккал/день (±10%)
БЖВ цілі: ~{protein}г білків / ~{fat}г жирів / ~{carbs}г вуглеводів
Мета: {mainGoal}
Поточний місяць: {month} — пріоритизуй сезонні продукти для України
Улюблені продукти: {favoriteFoods}
НЕ включати: {dislikedFoods}
Обмеження: {dietaryPreferences}, алергії: {allergies}
Страви з хорошим рейтингом (повторити подібні): {highRatedMeals}
Страви з поганим рейтингом (не повторювати): {lowRatedMeals}
Якщо страва готується на 2-3 дні — позначити isMultiDayPrep: true, multiDayPrepDays: N.
Для кожної страви також надай 2 швидкі альтернативи з тією ж калорійністю (±10%) у полі quickAlternatives.
```

**Сезонні підказки в промпті** (авто-підставляються):
- Зима (12-2): буряк, морква, капуста, яблука, хурма
- Весна (3-5): редиска, шпинат, зелена цибуля
- Літо (6-8): помідори, огірки, кабачки, ягоди, перець
- Осінь (9-11): гарбуз, гриби, груші, слива

**Захист**: `goalCalories = Math.max(1200, calculatedGoal)` — ніколи нижче 1200 ккал для жінок.

**JSON-схема відповіді**:
```json
{
  "days": [
    {
      "dayLabel": "Понеділок",
      "meals": {
        "breakfast": { /* повний AIMeal з quickAlternatives */ },
        "lunch": { /* AIMeal */ },
        "dinner": { /* AIMeal */ },
        "snacks": [{ /* AIMeal */ }]
      }
    }
  ]
}
```

**Обробка після отримання відповіді**:
1. Парсинг + структурна валідація JSON
2. Підрахунок `totalCalories` і `totalPrepMinutes` для кожного дня
3. Обробка `isMultiDayPrep` — копіювання snapshot на наступні дні
4. Встановити `isConsumed: false`, `rating: null` для всіх страв
5. Архівувати попередній `active` документ
6. Зберегти новий `weekly_menus`
7. Виклик `shoppingListBuilder`

**API маршрут**: `POST /api/menu/generate`
- Rate limit: максимум **3 генерації на тиждень** на користувача
- Retry: 3 спроби з exponential backoff (1s → 2s → 4s)
- Fallback: якщо AI недоступний → повернути останнє active меню
- `max_tokens`: встановити бюджет (≈ 4000 токенів на відповідь)
- `OPENAI_API_KEY` — тільки на сервері

---

## Управління харчовими вподобаннями

### `PUT /api/profile/food-preferences`
```json
{
  "favoriteFoods": ["гречка", "курятина", "броколі"],
  "dislikedFoods": ["баклажани", "печінка"],
  "dietaryPreferences": ["без молочних"],
  "allergies": ["горіхи"]
}
```

### UI (сторінка `/profile`):
- `TagInput` для улюблених/небажаних продуктів
- Чекбокси дієтичних переваг
- Кнопка "Зберегти та перегенерувати меню"

---

## TypeScript типи

| Файл | Що містить |
|------|-----------|
| `src/types/meals.ts` | `AIMeal`, `MealCategory`, `ShoppingCategory`, `DayMeals` |
| `src/types/weeklyMenu.ts` | `WeeklyMenu`, `MenuDay` |
| `src/types/shoppingList.ts` | `ShoppingList`, `ShoppingListItem`, `GroupedShoppingItems` |
| `src/types/engagement.ts` | `Tip`, `UserStreak`, `StreakBadge`, `WaterLog`, `WeightLog`, `FavoriteMeal` |
| `src/types/userProfile.ts` | `UserProfile` (розширює `OnboardingData`) |

---

## Архітектура компонентів

```
src/
├── app/
│   ├── menu/
│   │   ├── layout.tsx                  ← AppShell з BottomNavBar
│   │   └── page.tsx                    ← замінити заглушку
│   ├── shopping-list/
│   │   └── page.tsx
│   ├── profile/
│   │   └── page.tsx
│   └── api/
│       ├── menu/
│       │   ├── generate/route.ts       ← POST → OpenAI (rate limited)
│       │   ├── weekly/route.ts         ← GET
│       │   ├── meal/
│       │   │   ├── swap/route.ts       ← POST (+ scaleMealToCalories + totalCalories recalc)
│       │   │   ├── consume/route.ts    ← PATCH isConsumed
│       │   │   ├── rate/route.ts       ← PATCH rating
│       │   │   ├── custom/route.ts     ← POST/DELETE власні з'їдені страви
│       │   │   └── alternatives/route.ts ← GET ліниво генерує quickAlternatives
│       │   ├── food/
│       │   │   └── parse/route.ts      ← POST LLM-оцінка калорій/БЖВ
│       │   └── complete-day/route.ts
│       ├── shopping-list/route.ts      ← GET/PATCH/POST
│       ├── water/route.ts              ← GET/POST
│       ├── streak/route.ts             ← GET
│       ├── tips/route.ts               ← GET
│       ├── weight/route.ts             ← GET/POST (нова)
│       ├── favorites/route.ts          ← GET/POST/DELETE (нова)
│       ├── profile/
│       │   ├── route.ts
│       │   └── food-preferences/route.ts
│       └── push/
│           ├── subscribe/route.ts
│           └── unsubscribe/route.ts
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── BottomNavBar.tsx            ← Menu / Shopping / Profile
│   │   └── StickyCalorieHeader.tsx     ← ккал + БЖВ міні
│   ├── menuPage/
│   │   ├── WeeklyMenuView.tsx
│   │   ├── DayTabBar.tsx               ← scroll-snap
│   │   ├── DayView.tsx                 ← + DayPrepTimeBadge
│   │   ├── MealCard.tsx                ← swipe gestures, emoji, ккал, БЖВ міні
│   │   ├── MealDetailSheet.tsx         ← BottomSheet
│   │   ├── IngredientsTab.tsx          ← + ServingsSelector
│   │   ├── RecipeTab.tsx
│   │   ├── SwapMealPanel.tsx           ← quickAlternatives першими, AI як fallback
│   │   ├── MealRatingWidget.tsx        ← (не використовується — замінено inline-picker у MealCard)
│   │   ├── CalorieProgressBar.tsx      ← sticky
│   │   ├── MacroProgressBar.tsx        ← Б / Ж / В прогрес
│   │   ├── DayMealProgress.tsx         ← "2 з 4 прийомів ✓"
│   │   ├── MultiDayPrepBadge.tsx
│   │   ├── DayPrepTimeBadge.tsx        ← "Швидкий день ⚡" / "Підготовчий 🍳"
│   │   ├── DailyTipCard.tsx
│   │   ├── StreakBanner.tsx
│   │   ├── WaterTracker.tsx
│   │   ├── WeightProgressCard.tsx      ← міні-графік ваги на головній
│   │   ├── AddCustomFoodSheet.tsx      ← власна страва: назва+вага → LLM → правка
│   │   ├── CustomEntryCard.tsx         ← картка власної страви (видалення)
│   │   └── GenerateMenuLoader.tsx
│   ├── shoppingListPage/
│   │   ├── ShoppingListView.tsx
│   │   ├── DayFilterTabs.tsx           ← "Пн-Ср" / "Чт-Нд" / "Весь тиждень"
│   │   ├── CategorySection.tsx
│   │   ├── ShoppingItem.tsx
│   │   ├── AddCustomItemForm.tsx
│   │   └── OfflineIndicator.tsx        ← індикатор офлайн-режиму
│   ├── profilePage/
│   │   ├── FoodPreferencesEditor.tsx
│   │   ├── DietaryPreferences.tsx
│   │   ├── WeightLogSection.tsx        ← повний графік ваги
│   │   └── NotificationSettings.tsx
│   └── common/
│       ├── BottomSheet.tsx             ← @headlessui/react Dialog
│       ├── TagInput.tsx
│       ├── Toast.tsx                   ← мотиваційні повідомлення
│       ├── ThemeToggle.tsx             ← перемикач світла/темної теми (localStorage)
│       ├── ErrorBoundary.tsx
│       └── SkeletonCard.tsx            ← skeleton screens
│
├── hooks/
│   ├── useWeeklyMenu.ts
│   ├── useShoppingList.ts              ← оптимістичні оновлення + IndexedDB офлайн
│   ├── useStreak.ts
│   ├── useWaterTracker.ts
│   ├── useWeightLog.ts                 ← нова
│   ├── useFavorites.ts                 ← нова
│   ├── useDailyTip.ts                  ← sessionStorage кеш
│   ├── usePushNotifications.ts
│   └── useAnalytics.ts                 ← event tracking
│
└── lib/
    ├── menu/
    │   ├── generateMenuWithAI.ts       ← OpenAI + retry + rate limit
    │   ├── parseCustomFood.ts          ← gpt-4o-mini: назва+вага → per100 → БЖВ
    │   ├── shoppingListBuilder.ts      ← агрегація + quantityByDay + mergeShoppingItems (ре-синк)
    │   └── streakUpdater.ts
    ├── analytics.ts                    ← track() функція
    └── push/
        └── sendPushNotification.ts
```

---

## API маршрути

| Метод | Маршрут | Опис |
|-------|---------|------|
| POST | `/api/menu/generate` | Генерація меню (rate limited: 3/тиждень) |
| GET | `/api/menu/weekly` | Поточний тиждень |
| POST | `/api/menu/meal/swap` | Замінити страву (масштабує калорії + перераховує `totalCalories` дня) |
| GET | `/api/menu/meal/alternatives` | Лінива генерація альтернатив для одної страви |
| PATCH | `/api/menu/meal/consume` | Відмітити страву з'їденою |
| PATCH | `/api/menu/meal/rate` | Рейтинг страви (1/2/3) |
| POST | `/api/menu/complete-day` | Відмітити день |
| POST | `/api/menu/food/parse` | LLM-оцінка калорій/БЖВ за назвою+вагою (на 100 г → масштаб) |
| POST/DELETE | `/api/menu/meal/custom` | Додати/видалити власну з'їдену страву (inline у weekly_menus) |
| GET | `/api/shopping-list` | Список покупок |
| PATCH | `/api/shopping-list` | Toggle куплено |
| POST | `/api/shopping-list` | Додати свій товар |
| GET | `/api/water` | Сьогоднішнє споживання |
| POST | `/api/water` | Зафіксувати порцію |
| GET | `/api/streak` | Дані стріку |
| GET | `/api/tips` | Щоденний лайфхак |
| GET/POST | `/api/weight` | Трекер ваги |
| GET/POST/DELETE | `/api/favorites` | Улюблені страви |
| GET/PUT | `/api/profile` | Профіль |
| PUT | `/api/profile/food-preferences` | Вподобання |
| POST | `/api/push/subscribe` | Push підписка |
| POST | `/api/push/unsubscribe` | Видалити підписку |

---

## UX / UI (мобільний)

| Елемент | Деталі |
|---------|--------|
| **AppShell** | Full-screen, `padding-bottom: env(safe-area-inset-bottom)` |
| **DayTabBar** | `scroll-snap-type:x mandatory`, auto-scroll активного дня |
| **BottomSheet** | Слайд знизу, `max-height:85vh`, Headless UI Dialog |
| **MealCard** | Emoji + назва + ккал + міні БЖВ; **swipe left** → swap, **swipe right** → consume ✓, **long press** → save ❤️ |
| **MealCard consumed** | Зелений фон `bg-green-50`, badge "✓ з'їдено", назва закреслена |
| **DayMealProgress** | "2 з 4 прийомів ✓" під заголовком дня |
| **DayPrepTimeBadge** | "Швидкий день ⚡" (всі ≤20хв) або "Підготовчий 🍳" |
| **CalorieProgressBar** | Sticky зверху, колір: зелений/жовтий/червоний |
| **MacroProgressBar** | Б: Xг/Xг · Ж: Xг/Xг · В: Xг/Xг |
| **WeightProgressCard** | Міні-спарклайн "-1.2 кг за 3 тижні" (тижневий тренд!) |
| **MealCard rating** | Кнопка 😊 на картці поруч зі swap — з'являється коли страва з'їдена; тап розкриває inline-ряд 👎 😐 😍; після вибору показується обрана емодзі |
| **ServingsSelector** | +/- кнопки в IngredientsTab, пропорційний перерахунок |
| **DayFilterTabs** | Shopping list: "Пн-Ср" / "Чт-Нд" / "Весь тиждень" |
| **OfflineIndicator** | Помаранчева смужка зверху у офлайн-режимі |
| **Toast** | Мотиваційні: без негативу, "Повернулась! Це вже перемога 🎉" при пропуску |
| **Haptic feedback** | Vibration API при consume, rate, streak |
| **Pull-to-refresh** | На головній сторінці меню |
| **Tap targets** | Мін 44×44px для всіх інтерактивних елементів |
| **a11y** | `aria-labels` для емодзі, screen reader для прогрес-барів |
| **Dark mode** | Всі компоненти: `dark:` класи; перемикач `ThemeToggle` (☀️/🌙) у хедері кожної захищеної сторінки; стан зберігається в `localStorage` (`nd_theme`) |
| **Кольори секцій** | Breakfast `#3B82F6` (синій), Lunch `#F97316` (оранж), Dinner `#8B5CF6` (фіолет), Snack `#10B981` (зелений); CSS-змінні в `:root`/`.dark` |
| **Кольори** | Orange `#f97316`, Yellow `#f4b619`, Red `#eb3c5a`; тіні карток: light `shadow-[0_2px_8px_rgba(0,0,0,0.08)]`, dark `shadow-[0_0_0_1px_rgba(255,255,255,0.07),_0_6px_24px_rgba(120,120,120,0.25)]` |

---

## PWA налаштування

1. **`public/manifest.json`**:
   - `name: "EasyMenu"`, `short_name: "EasyMenu"`
   - `start_url: "/menu"`, `display: "standalone"`, `orientation: "portrait"`
   - `theme_color: "#f97316"`, `lang: "uk"`
   - Іконки 192×192 і 512×512 PNG

2. **`src/app/layout.tsx`** — мета-теги:
   - `<link rel="manifest">`, `<meta name="theme-color">`
   - `apple-touch-icon`, `apple-mobile-web-app-capable`

3. **Service Worker**: `@ducanh2912/next-pwa`, `disable` в dev

4. **Offline для shopping list**:
   - Service Worker кешує останній shopping list
   - Відмітки "куплено" зберігаються в **IndexedDB**
   - При відновленні → синхронізація (conflict resolution: `last-write-wins` за `purchasedAt`)

5. **Push нотифікації**:
   - VAPID ключі в `.env`
   - `web-push` npm пакет
   - iOS: показати "Додати на головний екран"

---

## Функції залучення

### Стрік-система
- Стрік рахується якщо **≥3 з 4** прийомів їжі consumed (не обов'язково 100%)
- `isCompleted` дня = авто при досягненні порогу
- Бейджі: 3 / 7 / 14 / 30 / 60 / 100 днів
- **Без покарань**: пропуск не обнуляє жорстко — "Повернулась! Це вже перемога 🎉"

### Трекер ваги (ключовий мотиватор)
- Нагадування 1 раз на тиждень (п'ятниця зранку)
- Показувати: тижневий/місячний тренд, не щоденні коливання
- `WeightProgressCard`: "-1.2 кг за 3 тижні" — найпотужніший мотиватор
- При зміні ваги → автоматичний перерахунок TDEE та `goalCalories`
- **Не показувати** різку зміну як "провал"

### Рейтинг страв → персоналізація AI
- Кнопка 😊 на `MealCard` (поруч зі swap) — видима коли страва з'їдена і ще не оцінена; тап розкриває inline-ряд 👎 😐 😍 прямо на картці (без модалки)
- Після вибору — обрана емодзі залишається на картці як індикатор
- Передається в промпт наступної генерації:
  - Високий рейтинг → "повтори подібні"
  - Низький рейтинг → "не повторювати"

### Улюблені страви
- ❤️ кнопка на MealCard (long press або іконка)
- При swap → показувати улюблені першими
- "Повторити минулий тиждень" — якщо було вдале меню

### Щоденний лайфхак
- `GET /api/tips?date=YYYY-MM-DD` → `dateHash % count` (той самий хак весь день)
- Контекстний вибір категорії: hydration якщо мало води, motivation якщо стрік перервано

### Трекер води
- CSS прогрес-коло, кнопки +200/250/350/500мл
- Оптимістичне оновлення + POST `/api/water`
- localStorage офлайн-fallback

### Мотиваційні повідомлення (Toast — без негативу)
- Виконання дня: "Чудово! X днів поспіль 🔥"
- Перший прийом: "Доброго ранку! Ціль {goalCalories} ккал"
- Бейдж: анімація розблокування
- Список куплений: "Все готово до тижня!"
- Ціль води: "Водний баланс — ✓"

### Розумні нагадування (Tier 2, Фаза 6)
- "Борщ на завтра — підготуй інгредієнти сьогодні ввечері" (multi-day prep)
- "5-денний стрік! Не зупиняйся 💪"
- "Залишилось 800мл до цілі з водою"
- "Сьогодні легкий день — всі страви за 15 хв!"

### Тижневий звіт (Tier 2, Фаза 7)
- Щонеділі: днів дотримання, середні ккал vs ціль, топ-3 страви, динаміка ваги
- Мотиваційне повідомлення від AI
- Шерінг картинки для Instagram Stories

---

## Власні з'їдені страви (LLM-оцінка)

Користувач може додати з'їдене **поза AI-меню** (домашня страва, продукт, перекус у кафе), і воно враховується в денних калоріях/БЖВ та в логіці стріку.

**Рішення**: оцінка через **LLM `gpt-4o-mini`**, а не зовнішнє nutrition-API — англомовні бази (Nutritionix/Edamam/USDA) погано підходять для україномовних домашніх страв. Вага **обов'язкова**: користувач вводить назву + вагу (г), LLM оцінює склад **на 100 г** (його сильна сторона), а абсолютні калорії/БЖВ рахуються `per100 × grams/100`. Значення завжди можна підправити вручну перед збереженням.

- **Зберігання**: inline у `weekly_menus.days[].customEntries[]` (без окремої колекції). `CustomEntry` тримає абсолютні калорії/БЖВ + `per100`/`grams` для перерахунку у формі.
- **Підрахунок**: `calcConsumedMacros()` у `DayView` додає суму `customEntries` до з'їдених страв меню; лічильник «N з M прийомів» і завершення дня (≥3) теж їх враховують.
- **`parseCustomFood(text, grams)`** (`src/lib/menu/parseCustomFood.ts`): окремий OpenAI-клієнт, `gpt-4o-mini`, `json_object`, 2 спроби; повертає `{ error }` лише для не-їжі → UI робить fallback на ручний ввід (вага вже введена).
- **API**: `POST /api/menu/food/parse` (оцінка, не зберігає), `POST/DELETE /api/menu/meal/custom` ($push/$pull + дублює логіку завершення дня з consume route).
- **UI**: `AddCustomFoodSheet` (крок 1: назва+вага → крок 2: редаговані поля зі степером ваги, що перераховує через `per100`), `CustomEntryCard` (видалення), секція «Мої страви» в `DayView`.

> **Gotcha (dev)**: не запускати `next build`, поки активний `next dev` — build перезаписує `.next/`, після чого dev-сервер віддає 500 на всі роути. Для перевірки типів під час dev — `npx tsc --noEmit`.

> **Артефакти PWA**: `public/sw.js` і `public/workbox-*.js` генеруються білдом і додані в `.gitignore` (не комітити).

---

## Безпека та граничні випадки

### Захист від нездорових харчових патернів
- `goalCalories = Math.max(1200, tdee - deficit)` — жорсткий мінімум для жінок
- Якщо BMI < 18.5 → м'яке попередження + рекомендація консультації
- Мова без негативного фреймінгу: "трохи більше — це нормально, завтра новий день!"
- Стрік: не карати за пропуск — позитивне підкріплення повернення

### AI rate limiting та обробка помилок
- Максимум **3 генерації/тиждень** на користувача (зберігати лічильник в `user_profiles`)
- Retry: 3 спроби, exponential backoff (1s / 2s / 4s)
- Fallback: показати останнє `active` меню, якщо AI недоступний
- Базова sanity check відповіді: перевіряти структуру JSON
- `max_tokens` budget встановити в API виклику

### Multi-day prep + swap конфлікт
- Якщо юзер тапає swap на страві з `isMultiDayPrep` → попередження:
  > "Цю страву готується в Понеділок на 3 дні. Замінити лише сьогодні чи всі 3 дні?"
- Варіанти: замінити один день / замінити всі пов'язані дні
- Після swap → перерахунок shopping list

### Зміна порцій (`servings`)
- ServingsSelector в IngredientsTab: кнопки 1 / 2 / 3
- Відображення інгредієнтів: `quantity * servings`
- Калорії у CartCard: `calories * servings`
- Оновлення shopping list після зміни
- Multi-day prep: "Борщ на 3 дні = 6 порцій"

### Offline shopping list (IndexedDB)
- При відмітці "куплено" → зберегти в IndexedDB з `purchasedAt: Date.now()`
- При поверненні онлайн → batch sync до сервера
- Conflict resolution: `last-write-wins` за таймстемпом

---

## Аналітика (event tracking)

```ts
// src/lib/analytics.ts — track() функція
track('menu_generated', { week, goalCalories, aiModel });
track('meal_viewed', { mealName, mealType });
track('meal_consumed', { mealName, mealType });
track('meal_rated', { mealName, rating });
track('meal_swapped', { originalMeal, newMeal, wasQuickAlternative });
track('meal_saved_favorite', { mealName });
track('shopping_item_checked', { category });
track('shopping_day_filter_used', { filter });
track('water_logged', { amount, totalToday });
track('weight_logged', { delta });
track('streak_completed', { streakLength });
track('streak_badge_earned', { badgeId });
track('push_permission_granted');
track('push_permission_denied');
track('servings_changed', { mealName, newServings });
track('weekly_summary_viewed');
```

---

## Технічні нюанси

1. **TDEE gap**: при першому вході в `/menu` → обчислити за формулою (буде надана) та зберегти в `user_profiles`

2. **Middleware**: оновити `src/middleware.ts`:
   ```ts
   matcher: ['/menu/:path*', '/shopping-list/:path*', '/profile/:path*']
   ```

3. **Session identity**: `readSessionUserId()` → email → `userEmail` у всіх колекціях

4. **MongoDB nested arrays** (consume/rate meal):
   ```js
   db.weekly_menus.updateOne(
     { _id: id, userEmail },
     { $set: { "days.$[day].meals.lunch.isConsumed": true } },
     { arrayFilters: [{ "day.date": targetDate }] }
   )
   ```

5. **quickAlternatives у промпті**: збільшує розмір відповіді і вартість — встановити `max_tokens` і виміряти реальний token usage перед production

6. **Контраст кольорів**: перевірити orange `#f97316` на білому фоні (WCAG AA — мінімум 4.5:1)

7. **Turbopack + next-pwa**: `disable: process.env.NODE_ENV === 'development'`

8. **iOS push**: потребує "Add to Home Screen" — показати інструкцію після login

---

## Фази реалізації

### ✅ Фаза 1 — Foundation + AI Menu (MVP)
- [x] TypeScript типи з `isConsumed`, `rating`, `quickAlternatives`, `servings` в `AIMeal`
- [x] `src/middleware.ts` — нові маршрути
- [x] `AppShell` + `BottomNavBar` + `src/app/menu/layout.tsx`
- [x] `user_profiles` — заповнення при першому вході, min 1200 ккал guard
- [x] `generateMenuWithAI.ts` — з сезонністю, quickAlternatives, retry, rate limit
- [x] `POST /api/menu/generate` + `GET /api/menu/weekly`
- [x] `WeeklyMenuView`, `DayTabBar`, `DayView`
- [x] `MealCard` — базова + `DayMealProgress`
- [x] `MealDetailSheet` — рецепт + інгредієнти + `ServingsSelector`
- [x] `CalorieProgressBar` + `MacroProgressBar`
- [x] `GenerateMenuLoader` (skeleton screens)
- [x] `PATCH /api/menu/meal/consume` + swipe right gesture
- [x] Замінити заглушку в `/menu/page.tsx`

**Результат**: AI-меню, рецепти, відмітка прийомів їжі ✅ **ВИКОНАНО**

---

### ✅ Фаза 2 — Список покупок + Offline
- [x] `shoppingListBuilder.ts` — з `forDays` агрегацією
- [x] `GET/PATCH/POST /api/shopping-list` — `src/app/api/shopping-list/route.ts`
- [x] `ShoppingListView` + `DayFilterTabs` + `CategorySection` + `ShoppingItem`
- [x] `AddCustomItemForm`
- [x] `src/app/shopping-list/page.tsx` — повноцінна сторінка (loading / no-list / has-list / error)
- [~] IndexedDB офлайн-шар — реалізовано через **localStorage** (`nd_shopping_queue`), не IndexedDB
- [x] Синхронізація при поверненні онлайн (`window.addEventListener('online', ...)`)
- [x] `OfflineIndicator` — банер при `!navigator.onLine`

**Результат**: Список покупок з фільтром по днях, offline-підтримкою та додаванням власних продуктів ✅ **ВИКОНАНО**

---

### ✅ Фаза 3 — Залучення + Трекер ваги
- [x] `weight_logs` collection + `GET/POST /api/weight`
- [x] `WeightProgressCard` (головна) + `WeightLogSection` (профіль)
- [x] Автоперерахунок TDEE при зміні ваги
- [x] Стрік: `streakUpdater.ts` (≥3/4 правило, бейджі) — логіка реалізована
- [ ] `POST /api/menu/complete-day` — окремий маршрут (поки вбудовано в consume)
- [x] `StreakBanner` + бейджі (UI)
- [x] `PATCH /api/menu/meal/rate` + `MealRatingWidget`
- [x] `favorite_meals` + `GET/POST/DELETE /api/favorites`
- [x] Засів `tips` (44 записи), `GET /api/tips`
- [x] `DailyTipCard` + контекстний вибір категорії
- [x] `WaterTracker` + `GET/POST /api/water`
- [x] `SwapMealPanel` — quickAlternatives першими
- [ ] Multi-day swap конфлікт — попередження + вибір
- [ ] `DayPrepTimeBadge` — окремий компонент не потрібен
- [x] Toast компонент
- [x] `src/lib/analytics.ts` + базовий tracking (console.debug в dev)

**Результат**: Трекер ваги, стрік-банер з бейджами, трекер води, лайфхак дня, улюблені страви ✅ **ВИКОНАНО**

---

### ✅ Фаза 4 — Профіль + харчові переваги
- [x] `src/app/profile/page.tsx` (повноцінна сторінка з BMR/TDEE, бейджами, FoodPreferencesEditor)
- [x] `FoodPreferencesEditor` — колапсована секція, чекбокси дієти + TagInput для улюблених/небажаних/алергій
- [x] `TagInput` — тег-інпут (Enter/кома додає, Backspace видаляє)
- [ ] `NotificationSettings` (часи нагадувань) — відкладено на Фазу 6
- [x] `GET/PUT/POST /api/profile` (профіль з розрахунком BMR/TDEE/goalCalories)
- [x] `PUT /api/profile/food-preferences` — оновлення харчових вподобань
- [x] Рейтинги страв → передача в AI промпт (реалізовано в generateMenuWithAI)

**Результат**: Редактор харчових вподобань, TagInput, API для збереження — AI враховує при генерації ✅ **ВИКОНАНО**

---

### ✅ Фаза 5 — PWA
- [x] Іконки 192px + 512px PNG (+ apple-touch-icon 180px)
- [x] `public/manifest.json` — shortcuts до /menu і /shopping-list
- [x] Мета-теги в `src/app/layout.tsx` — Viewport + metadata (manifest, appleWebApp, icons)
- [x] `@ducanh2912/next-pwa` у `next.config.ts` — disable в dev, skipWaiting у workboxOptions
- [x] `usePushNotifications` хук — subscribe/unsubscribe/permission
- [x] `POST /api/push/subscribe|unsubscribe` — колекція `push_subscriptions`
- [x] VAPID ключі згенеровані → `.env`
- [x] `NotificationSettings` компонент → profile/page.tsx
- [x] `usePwaInstall` хук — детект standalone/`navigator.standalone`/`appinstalled` + `beforeinstallprompt` (Android) → `promptInstall()`
- [x] `InstallBanner` (перейм. з IOSInstallBanner) — Android: кнопка «Встановити» (нативний промпт), iOS: інструкція з кроками → menu/layout.tsx + shopping-list/layout.tsx
- [x] `InstallAppSettings` — секція «📱 Застосунок» у profile/page.tsx (стан «Встановлено» / install-кнопка / iOS-кроки / desktop-fallback)

---

### ✅ Фаза 6 — Push + Smart notifications + Polish
- [ ] Server-side push (`web-push` + cron)
- [ ] Розумні контекстні нагадування (multi-day prep, streak, вода)
- [ ] Офлайн-обробка в service worker (shell caching)
- [ ] `ErrorBoundary` + empty states з ілюстраціями
- [ ] Haptic feedback (Vibration API)
- [ ] Pull-to-refresh
- [ ] Оптимізація bundle (lazy load BottomSheet)

---

### ✅ Фаза 7 — Weekly report + Social
- [ ] Тижневий звіт (компонент + AI-генерований текст)
- [ ] Кошторис тижня (орієнтовна вартість списку покупок для UA ринку)
- [ ] Шерінг картинки результату (Instagram Stories формат)
- [ ] `WeeklyCalorieChart` (7-денний огляд)

---

## Масштабованість та безпека (аудит) ✅

Окремий аудит схеми зберігання даних/акаунтів/оплат і підготовка до 1000–10000
користувачів. Деплой-таргет: Vercel / serverless.

### Фаза A — критична інфраструктура
- **Індекси MongoDB** — `src/lib/ensureIndexes.ts` (єдине джерело правди), авто-створення
  раз на інстанс із `getDb()`; ідемпотентне. Покриває гарячий шлях (`sessions.id`,
  `users.email`, `*.userEmail` тощо) + TTL на `sessions.expiresAt` і `magic_links.expiresAt`.
- **`maxPoolSize`** у `src/lib/db.ts` (env `MONGODB_MAX_POOL_SIZE`, default 10) — пул з'єднань Atlas.
- **Rate-limiting** — `src/lib/rateLimit.ts` (MongoDB fixed-window, fail-open) на
  `magic-link/request`, `subscription/init`, `liqpay/checkout`.
- **Ідемпотентність платежів** — `liqpay/callback` пише в `payment_events` з unique-індексом
  за `signature` (дедуп ретраїв/гонок + аудит-лог).

### Фаза B — продуктивність
- **Прибрано N+1** у `meal/consume` і `meal/custom` — completion дня рахується локально
  з уже завантаженого меню, без повторного читання (≈4-6 → 2-3 запити).
- **`water_logs` append-only** (див. модель вище) — усунуто безмежне зростання масиву
  та race read-modify-write (total через `$sum`).
- **Авто-архівація** — `weekly_menus.archivedAt` + TTL 60 днів; `shopping_lists` тримаємо
  лише поточний (`deleteMany`).

### Фаза C — безпека акаунтів
- **Ковзний TTL сесій** + `clearAllSessions()` (`src/lib/auth/session.ts`); роути
  `/api/auth/logout` і `/api/auth/logout-all` + кнопки «Вийти»/«Вийти на всіх пристроях» у профілі.
- **Email із сесії в `subscription/init`** — залогінений користувач не може писати в чужий акаунт.
- **POST-підтвердження magic-link** — лист веде на сторінку `/auth/confirm`; токен
  витрачається лише за кліком (POST), тож GET-префетчери/сканери його не «з'їдають».
  GET-роут consume лишений як редірект на confirm (бек-сумісність).
- **Гігієна секретів** — `.env` у `.gitignore`, в історії git ніколи не було; витоку немає.
- **Redis-кеш сесій** — свідомо відкладено (індекси вже зробили пошук швидким; повернутись
  при реальному навантаженні через Upstash/Vercel KV).

---

## Критичні файли для змін

| Файл | Зміна | Статус |
|------|-------|--------|
| `src/app/menu/page.tsx` | Замінити заглушку | ✅ Виконано |
| `src/middleware.ts` | Додати `/shopping-list/*`, `/profile/*` | ✅ Виконано |
| `src/app/layout.tsx` | PWA мета-теги | ⏳ Фаза 5 |
| `src/lib/db.ts` | Паттерн для всіх нових API маршрутів | ✅ Використовується |
| `src/lib/auth/session.ts` | `readSessionUserId()` → email; + ковзний TTL та `clearAllSessions()` | ✅ |
| `src/types/onboarding.ts` | Джерело для `UserProfile` | ✅ UserProfile extends OnboardingData |
| `next.config.ts` | next-pwa конфіг | ⏳ Фаза 5 |
| `.env` | `OPENAI_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | ⚠️ OPENAI_API_KEY — потрібно заповнити |

---

## Верифікація (end-to-end)

1. Авторизуватись → `/menu` → AI генерує меню → перевірити `weekly_menus` в MongoDB
2. Тапнути страву → BottomSheet з рецептом, інгредієнтами, ServingsSelector
3. Swipe right на MealCard → `isConsumed: true`; тапнути кнопку 😊 → inline-ряд оцінки 👎 😐 😍 на картці
4. Замінити страву → quickAlternatives (без AI), опція AI fallback
5. Multi-day страва → swap попередження з вибором
6. `/shopping-list` → фільтр по днях, offline: відмітити куплено без інтернету → sync при поверненні
7. Зважитись → графік ваги оновлюється, TDEE перераховується
8. ≥3 прийоми за день → стрік +1 + Toast без негативу
9. Профіль: небажаний продукт → перегенерувати → його немає
10. `goalCalories` ніколи не нижче 1200 ккал
11. Chrome: "Install App" → `display: standalone`
12. iOS: "Додати на головний екран" → без браузерного UI
13. "Додати свою страву" → назва + вага → LLM повертає калорії/БЖВ → зберегти → денні підсумки й лічильник прийомів зростають; видалення зменшує; F5 зберігає (inline у `weekly_menus`)

---

*Документ оновлювати в міру реалізації фаз. Виконані пункти позначати `[x]`.*

---

## 🔧 Changelog — ціль харчування впливає на норму калорій + редагування у профілі (2026-05-31)

### Проблема
Ціль харчування (`mainGoal`, обирається на `onboarding/main-goal`) **ніде не впливала на денну норму** (`goalCalories`). Розрахунок дублювався у 3 місцях, і всі використовували плоский дефіцит `TDEE − 500` замість корекції під ціль — для набору ваги це навіть мінусувало калорії. `mainGoal` потрапляв лише в текст промпта генерації, але не в число калорій. До того ж біометрію/ціль **не можна було змінити** після першого налаштування (форма у профілі показувалась лише за відсутності профілю).

### Формула (узгоджено)
```
BMR (Mifflin-St Jeor):  чол: 10×вага + 6.25×зріст − 5×вік + 5
                        жін: 10×вага + 6.25×зріст − 5×вік − 161
TDEE = BMR × коефіцієнт_активності
Норма = max(поріг, round(TDEE × коефіцієнт_цілі))
  lose_weight ×0.85 · gain_weight ×1.15 · build_muscle ×1.15
  maintain_weight ×1.0 · something_else ×1.0
  поріг: 1200 ккал (жінки) / 1500 ккал (чоловіки)
```

### Зміни
1. **Єдине джерело правди — новий `src/lib/calories.ts`**: `calcBmr()`, `calcCalories()` → `{ bmr, tdee, goalCalories }`, `goalFactor()`, `GOAL_FACTORS`, `normalizeSex()` («Чоловік/Жінка» → `male/female`). Усуває 3 дубльовані копії формули.
2. **Підключення модуля** (прибрано локальні формули):
   - `src/app/api/profile/route.ts` — POST + PUT; **PUT тепер перераховує і при зміні `mainGoal`**, не лише біометрії.
   - `src/app/api/auth/magic-link/consume/route.ts` — авто-ініціалізація профілю враховує `mainGoal`.
   - `src/components/onboardingPage/CaloriesCalcList.tsx` — прев'ю через спільний `calcBmr`.
3. **Редагування у профілі — новий `src/components/profilePage/BiometricsGoalEditor.tsx`**: стать, вік, вага, зріст, активність **+ селектор цілі** (5 опцій як на `main-goal`). Два режими: форма налаштування (профілю нема) і **згортувана секція «⚙️ Мої дані та ціль»** (профіль є — раніше read-only). Зберігає через `PUT /api/profile`, зведення оновлюється наживо. У `src/app/profile/page.tsx` inline-форму замінено на компонент (доступний завжди); ціль показується словами (`GOAL_LABELS`) поряд із нормою.

### Перевірка
- `npx tsc --noEmit` → exit 0.
- Зміна `lose_weight → gain_weight` при тій самій біометрії → `goalCalories` стрибає з `TDEE×0.85` на `TDEE×1.15`; поріг 1200 не пробивається.

### Відоме обмеження (поза цією зміною)
- `src/app/api/onboarding/route.ts` — заглушка (no-op `{ success: true }`) → `users.onboarding` не заповнюється, профіль фактично налаштовується через сторінку профілю. Каверза: онбординг до автентифікації (немає email-ключа). Потенційний окремий крок. _(Лог тіла з PII прибрано — див. OWASP-changelog 2026-06-11.)_

---

## 🔧 Changelog — список покупок: коректні суми по періодах + синхронізація з меню (2026-05-31)

### Проблема
Три баги у списку покупок:
1. **Продукти, яких немає в меню.** Список будувався один раз при генерації і не оновлювався при свопі страви — інгредієнти старої страви лишались (привиди), нової — були відсутні.
2. **Вага не відповідала сумі інгредієнтів страв.** Частково тому, що у вкладках періодів показувалась тижнева вага (наслідок бага 3); решта — фрагментація за одиницями/назвами (див. обмеження).
3. **«Весь тиждень» ≠ Пн–Ср + Чт–Нд** (могло бути і більше, і менше). Перемикач періодів лише **показував/ховав** елементи, а `quantity` завжди дорівнювала тижневому тоталу. Інгредієнт, потрібний в обох половинах, рахувався двічі (суми половин > тиждень); а елементи з міткою дня, що не збігалась із захардкодженим списком (різні апострофи в «П'ятниця»), випадали з обох половин (тиждень > суми половин).

### Корінь
Список — **снапшот**, а період був **фільтром show/hide**, не ре-агрегацією. Поденні кількості схлопувались в один тотал при білді й на клієнті не відновлювались. А зміни меню (своп) список взагалі не зачіпали.

### Зміни
1. **Поденна розбивка — `ShoppingListItem.quantityByDay: number[]`** (`src/types/shoppingList.ts`, [0]=Пн…[6]=Нд). `buildShoppingList` (`src/lib/menu/shoppingListBuilder.ts`) накопичує кількість по дню; тижневий тотал рахується з уже **округлених** поденних значень → Пн–Ср + Чт–Нд = тиждень **точно**, без дрейфу ±0.1.
2. **Суми по періоду за індексом дня** — `periodQuantity()` / `isVisibleInPeriod()` у `src/components/shoppingListPage/DayFilterTabs.tsx` (прибрано `matchesDayFilter` + захардкоджені списки днів). Звірка за **індексом**, не за лейблом → проблема апострофа зникла. `ShoppingListView` показує кількість саме за обраний період (`{ ...item, quantity: periodQuantity(...) }`).
3. **Ре-синк при свопі** — `src/app/api/menu/meal/swap/route.ts` перебудовує список з оновленого меню. `mergeShoppingItems()` зберігає позначки «куплено» (ключ `назва+одиниця`) і ручні товари «своє».
4. **Самовідновлення legacy-списків** — `GET /api/shopping-list` одноразово добудовує `quantityByDay` зі старого списку від активного меню; генерацію витрачати не треба.
5. Ручні товари (`POST /api/shopping-list`) → `quantityByDay: []`, показуються в усіх вкладках (не прив'язані до дня меню).

### Інваріант (збережено в авто-пам'ять)
Список покупок = похідний снапшот меню. **Будь-яка мутація меню → перебудова списку** (`buildShoppingList` + `mergeShoppingItems`). Робить `generate` (свіжо, без merge) і `swap` (merge). `consume`/`rate` не потребують (інгредієнти не міняються). Нові роути-редактори меню мають робити те саме.

### Перевірка
- `npx tsc --noEmit` → exit 0.
- Інваріант `Пн–Ср + Чт–Нд === тиждень` — 100k рандомних векторів кількостей, 0 розбіжностей.

### Відоме обмеження (наступний крок — баг 2, друга частина)
**Канонізація одиниць і назв НЕ зроблена**: «Цибуля 1 шт» і «Цибуля 50 г» досі окремі рядки (ключ агрегації = `назва+одиниця`), «помідори»/«томати» не зливаються, немасові одиниці (`ст.л.`, `склянка`) у грами не зводяться. Це причина залишкових розбіжностей ваги по конкретному продукту. Period-overlap частину бага 2 вже закрито.

---

## 🔧 Changelog — Промпт v2: кілька страв за прийом + рецепти з кроками (2026-06-01)

### Мотивація
1. **Якість рецептів**: AI генерував опис страви суцільним текстом — кроки приготування не відділялись і не нумерувались. Потрібні рецепти з кроками з нового рядка для складних страв (≥3 інгредієнтів або термічна обробка).
2. **Реалістичність прийомів їжі**: одна страва на сніданок або обід — занадто спрощена модель. Реальний сніданок = вівсянка + яблуко; обід = основне + гарнір + салат. Потрібно декілька карток страв під кожним прийомом.
3. **Тестування промпту**: тимчасово прибрати ліміт генерації, щоб зручно ітерувати промпт без очікування нового тижня.

### Зміни

#### 1. Rate limit тимчасово відключено
**`src/app/api/menu/generate/route.ts`**:
```ts
// Було:
const MAX_GENERATIONS_PER_WEEK = 3;
// Стало:
const MAX_GENERATIONS_PER_WEEK = 999; // тимчасово необмежено для тестування промпту
```
> Повернути `3` після затвердження фінального промпту.

#### 2. Тип `DayMeals` — всі прийоми стали масивами
**`src/types/meals.ts`**:
```ts
// Було:
export interface DayMeals {
  breakfast: AIMeal;
  lunch: AIMeal;
  dinner: AIMeal;
  snacks: AIMeal[];
}
// Стало:
export interface DayMeals {
  breakfast: AIMeal[];
  lunch: AIMeal[];
  dinner: AIMeal[];
  snacks: AIMeal[];
}
```
Тепер усі чотири прийоми є масивами, що дозволяє AI повертати 1–2 страви на сніданок і 2–3 на обід/вечерю. Паттерн `snacks` вже був масивом — тепер однорідна модель.

#### 3. `generateMenuWithAI.ts` — рефакторинг парсингу та промпту
**`src/lib/menu/generateMenuWithAI.ts`**:

- **Новий хелпер `normalizeArray(raw)`**: приймає масив або одиночний об'єкт (для зворотньої сумісності зі старими меню в БД) і завжди повертає `AIMeal[]`.
- **`mapDays`**: тепер викликає `normalizeArray` для `breakfast`, `lunch`, `dinner` і `snacks`; `allMeals` рахується через `[...breakfast, ...lunch, ...dinner, ...snacks]`.
- **`buildPrompt`**: прибрано деталізацію структури ("сніданок, обід, вечеря, 1 перекус") — вона тепер у `SYSTEM_PROMPT`.
- **`DIETITIAN_PERSONA` — правило DISHES оновлено**:
  - Було: "For complex lunch and dinner dishes (3+ ingredients) put a clear, step-by-step chef-style recipe in `description`"
  - Стало: "Write a step-by-step chef-style recipe in `description` when the dish has **3+ ingredients OR any ingredient requires heat treatment** (boiling, frying, stewing, baking). **Number each step and separate them with `\n` (newline)**. For simple ready-to-eat foods (fresh fruit, nuts, plain yoghurt) a single short sentence is enough."
- **`SYSTEM_PROMPT` — нова структура**:
  - Вказано явні розміри прийомів: `breakfast (1–2 dishes)`, `lunch (2–3 dishes)`, `dinner (2–3 dishes)`, `snacks (1 dish)`.
  - Схема JSON оновлена — всі чотири поля тепер `[{...}]` (масиви).
  - Доданий **приклад дня** (`## EXAMPLE`) що демонструє:
    - Сніданок з 2 страв (Вівсянка з молоком + Яблуко)
    - Обід з 2 страв (Тушковане куряче філе — з нумерованим рецептом через `\\n` + Листовий салат)
    - Вечеря з 2 страв (Куряче філе на грилі з рецептом + Гречана каша з рецептом)
    - Перекус (Йогурт натуральний — коротке речення)
  - `\\n` у TypeScript-рядку генерує `\n` у рядку промпту — модель бачить правильний JSON-ескейп.

#### 4. Рефакторинг індексу страви в API та UI: `snackIndex` → `itemIndex`
До цих змін `snackIndex` використовувався лише для перекусів (`snacks[]`). Оскільки тепер усі прийоми є масивами, потрібен уніфікований індекс для будь-якої страви в будь-якому прийомі.

**Перейменовано в усіх файлах**: `snackIndex` → `itemIndex`. Логіка ідентична — індекс усередині масиву конкретного прийому.

**Зачеплені файли**:
| Файл | Зміна |
|------|-------|
| `src/app/api/menu/meal/consume/route.ts` | `snackIndex` → `itemIndex` в тілі запиту; `fieldName = mealType === 'snack' ? 'snacks' : mealType`; `updatePath = fieldBase.fieldName.itemIndex` для всіх типів |
| `src/app/api/menu/meal/rate/route.ts` | Те саме — `itemIndex` в тілі, `fieldName` + уніфікований `updatePath` |
| `src/app/api/menu/meal/swap/route.ts` | `itemIndex` в тілі; `mealArr = mealType==='snack' ? meals.snacks : meals[mealType]`; `mealArr[itemIndex]`; уніфікований `updatePath` |
| `src/app/api/menu/meal/alternatives/route.ts` | Query param `snackIndex` → `itemIndex`; тепер передається для **всіх** типів прийомів (не лише `snack`) |
| `src/components/menuPage/MealCard.tsx` | Prop `snackIndex` → `itemIndex` |
| `src/components/menuPage/MealRatingWidget.tsx` | Prop `snackIndex` → `itemIndex` |
| `src/components/menuPage/SwapMealPanel.tsx` | Prop `snackIndex` → `itemIndex`; `params.set('itemIndex', ...)` передається **завжди** (не тільки для snack) |
| `src/components/menuPage/DayView.tsx` | Props `snackIndex` → `itemIndex`; `.map` з `itemIndex={i}` для **всіх** прийомів |
| `src/components/menuPage/WeeklyMenuView.tsx` | Глобальна заміна `snackIndex` → `itemIndex`; lookup: `mealArr = mealType==='snack' ? meals.snacks : meals[mealType]` |

#### 5. `DayView` — секції рендеряться через `.map`
**`src/components/menuPage/DayView.tsx`**:
- `calcConsumedMacros` і `allMeals` використовують `[...breakfast, ...lunch, ...dinner, ...snacks]`.
- Кожна секція (Сніданок / Обід / Вечеря / Перекус) рендерить масив карток через `.map` із `space-y-2`.
- Секція прихована (`{arr.length > 0 && ...}`), якщо масив порожній.

#### 6. Агрегатори — flatten скрізь
| Файл | Зміна |
|------|-------|
| `src/lib/menu/shoppingListBuilder.ts` | `[...breakfast, ...lunch, ...dinner, ...snacks]` |
| `src/app/api/menu/generate/route.ts` | Те саме — при зборі `highRated`/`lowRated` |
| `src/app/api/menu/meal/custom/route.ts` | Те саме — при перевірці порогу завершення дня (≥3) |

### Структура MongoDB після змін
Поле `meals` у `weekly_menus.days[]` тепер:
```js
meals: {
  breakfast: [AIMeal, AIMeal],     // 1–2 страви
  lunch:     [AIMeal, AIMeal, AIMeal], // 2–3 страви
  dinner:    [AIMeal, AIMeal],     // 2–3 страви
  snacks:    [AIMeal]              // 1 страва
}
```
**Зворотня сумісність**: `normalizeArray()` у `mapDays` перетворює одиночний об'єкт (старі меню) у масив при читанні — клієнт завжди отримує масиви.

### Перевірка
- `npx tsc --noEmit` → exit 0.
- RecipeTab вже використовує `whitespace-pre-line` — `\n` у `description` рендеряться як переноси рядків без додаткових змін UI.

### Відомі наступні кроки
- Після затвердження якості промпту повернути `MAX_GENERATIONS_PER_WEEK = 3`.
- Після перегенерації нового меню старі документи в MongoDB (з `breakfast: AIMeal`) залишаються валідними завдяки `normalizeArray` — міграція не потрібна.

---

## 🎨 Changelog — UI Redesign: картки страв, секції, теми (2026-06-01)

### Мотивація
Редизайн сторінки `/menu` за HTML-референсом: чітка колірна ідентифікація прийомів їжі, помітний стан "з'їдено", кращі тіні для обох тем, зручніший перемикач теми на всіх сторінках.

### Зміни

#### 1. CSS-змінні для кольорів (`src/app/globals.css`)
Додано змінні в `:root` та `.dark`:
```css
/* :root */
--color-meal-breakfast: #3B82F6;
--color-meal-lunch:     #F97316;
--color-meal-dinner:    #8B5CF6;
--color-meal-snack:     #10B981;
--color-rating-bg / --color-rating-border     /* фон і рамка рядка оцінки */
--color-eaten-bg / --color-eaten-text / --color-eaten-border  /* badge "з'їдено" */
/* .dark: переопреділяє rating і eaten кольори */
```

#### 2. `MealCard.tsx` — повний редизайн
- **Нова структура**: `[emoji] [тіло: назва + ккал + макро + badges] [горизонтальний ряд кнопок]`
- **Ккал** — великий жирний шрифт (`text-[17px]`) кольором секції; менше 200 ккал → `text-sm`
- **Стан consumed**: `bg-green-50 border-green-200` (світла) / `bg-green-900/20` (темна), назва закреслена, badge "✓ з'їдено"
- **Рейтинг**: кнопка 😊 (Smile) у ряду actions — тап відкриває акордеон з 👎 😐 😍 нижче картки; після оцінки — обрана емодзі на місці кнопки
- **Actions**: горизонтальний ряд `[😊/емодзі] [↺ swap] [✓ consume]` — всі `w-7 h-7 rounded-full`
- **Тіні**: light `shadow-[0_2px_8px_rgba(0,0,0,0.08)]`; dark `shadow-[0_0_0_1px_rgba(255,255,255,0.07),_0_6px_24px_rgba(120,120,120,0.25)]`

#### 3. `DayView.tsx` — шапки секцій
Новий `SectionHeader` компонент (поза основним компонентом):
- Кольорова точка (`●`) кольору секції
- **Жирна назва** (`text-sm font-bold`) тим самим кольором
- Підсумок ккал секції + "· з'їдено ✓" коли вся секція закрита

#### 4. `DayTabBar.tsx` — вкладки днів
- **Виконаний день**: `✓` inline перед скороченою назвою дня (`✓ Пн`), зелений або білий (на активній вкладці)
- **Сьогодні**: `ring-2 ring-green-500` навколо вкладки замість зеленої точки знизу
- Фіксована висота вкладок — нічого не звисає знизу

#### 5. `ThemeToggle` — спільний компонент
- Виокремлено в `src/components/common/ThemeToggle.tsx`
- Стан `localStorage` (`nd_theme: 'light' | 'dark'`); при першому завантаженні — `prefers-color-scheme`
- Додано в хедер усіх трьох захищених сторінок: `/menu`, `/shopping-list`, `/profile`
- `/shopping-list` отримав постійний хедер "Список покупок" + кнопка теми

### Перевірка
- `npx tsc --noEmit` → exit 0.

---

## 🔧 Changelog — Детермінований розрахунок калорій/БЖВ з таблиці продуктів (2026-06-04)

### Проблема
`gpt-4.1-mini` систематично помилявся у калорійності страв:
- плутав «на 100 г» та «на порцію»;
- «вигадував» числа, ігноруючи фактичну вагу інгредієнтів у рецепті;
- застосовував білок одного інгредієнта до всієї складної тушкованої страви.

Результат — відхилення ±200–400 ккал/день від цілі, неправдиві значення БЖВ, 2 з 7 днів часто виходили сильно нижче цільової норми.

### Рішення
**Перенести розрахунок калорій/БЖВ із LLM у детермінований код.** LLM лише генерує страви з інгредієнтами та рецептами; числа `calories/protein/fat/carbs` рахуються з таблиці продуктів за фактичними вагами інгредієнтів.

---

### Зміни

#### 1. `src/lib/menu/foodNutrition.ts` — нові функції

**`toGrams(quantity, unit, name) → number`**
Конвертує (кількість, одиниця, назва) у грами:
- `г` / `мл` → пряма конвертація (1 мл ≈ 1 г)
- `ч.л.` → ×5 г; `ст.л.` → ×15 г
- `шт` → таблиця за назвою: яйце ≈ 55 г, картопля ≈ 120 г, морква/буряк ≈ 90 г, помідор/огірок/перець ≈ 100 г, банан/яблуко/груша ≈ 150 г, цибуля ≈ 70 г, часник ≈ 5 г; невідоме `шт` → 0 (dev-warn)
- Невідома одиниця → 0 (пропустити)

**`computeMealNutrition(ingredients) → { calories, protein, fat, carbs }`**
Підсумовує макро страви через `toGrams` + `lookupFood`. Невідомий інгредієнт → dev-warn (сигнал до розширення таблиці). `calories = P×4 + F×9 + C×4`.

**Доданий запис у FOOD_TABLE:**
`{ label: 'Рибне філе (загальне)', protein: 18, fat: 3, keywords: ['рибне філе', 'філе риби', ...] }` — для генеричних назв без конкретного виду риби.

---

#### 2. `src/lib/menu/generateMenuWithAI.ts`

**Промпт — видалено:**
- `CALORIES (most important):` — 5 правил про точне влучення в ціль ккал
- `PORTION WEIGHT (critical for calorie accuracy):` — узгодженість calories/ingredients/servingSize

**Промпт — додано `PORTION SIZING`:**
LLM використовує цільову калорійність лише як орієнтир для розміру порцій; числа не рахує.

**Промпт — новий блок `MEAL STRUCTURE` (обов'язковий):**
- Перша страва в сніданку/обіді/вечері — обов'язково з суттєвим протеїновим джерелом (м'ясо, риба, яйця, сир, йогурт ≥100 г, бобові); фрукт/хліб/крохмальне — не перша страва
- Обід — обов'язково окремий гарнір із круп/пасти (гречка, рис, макарони, пшоно тощо)
- Якщо в улюблених — фастфуд / кондитерські / жирні продукти: включати, але ≤20% від добової норми ккал

**Схема JSON:** видалено `calories / protein / fat / carbs` (~500 токенів економії на відповідь).

**`buildPrompt()`:** «дотримуйся ТОЧНО» → «орієнтир для розміру порцій»; рядок БЖВ-цілей — прибрано.

**`normalizeMeal()`:** тепер викликає `computeMealNutrition(ingredients)` замість `raw.calories/protein/fat/carbs`.

**Нова функція `scaleDayToTarget(meals, targetCalories)`:**
```
k = targetCalories / Σ(meal.calories × meal.servings)
|k - 1| ≤ 3% → нічого не робити
k клампується [0.5, 2.0] (dev-warn при крайніх значеннях)
Для кожної страви: calories, protein, fat, carbs, servingSize × k (round)
ingredient.quantity × k: шт → max(1, round), г/мл → max(5, round)
```
Зберігає `calories/servingSize` ratio — `ConsumePortionSheet` рахує ккал/г коректно.

**Нова функція `adjustDeficientDays(days, targetCalories)`:**
Якщо після scaling день < 88% цілі (k був обрізаний до 2.0):
- Шукає донора: спочатку ±1 день, потім будь-який з 7
- Слоти за пріоритетом: `lunch → breakfast → dinner`; потрібно ≥2 страви у донора і лише 1 у дефіцитного
- Копіює найменшу-за-калоріями страву (салат/гарнір) — donor незмінний
- Повторно запускає `scaleDayToTarget`

**Рефакторинг `mapDays()` → 4-прохідний pipeline:**
```
Pass 1  normalize: parse JSON + computeMealNutrition
Pass 2  scaleDayToTarget для всіх 7 днів (окрема петля)
Pass 3  adjustDeficientDays (бачить вирівняних сусідів)
Pass 4  totalCalories / totalPrepMinutes
```

**`generateMealAlternatives()`:**
- Промпт: явно передається цільова калорійність (`~${meal.calories} ккал`); LLM просять регулювати вагу інгредієнтів у грамах для влучення в ціль; схема JSON включає повну структуру `ingredients` (раніше модель повертала страви без інгредієнтів)
- Масштабування через `scaleMealToCalories(alt, meal.calories)` — виделено в окрему функцію

---

### Чому вирішує «2 з 7 дефіцитних»
Нові правила `MEAL STRUCTURE` примушують LLM щодня включати м'ясо/рибу/яйця + кашу/пасту — всі ці продукти 100% є в `FOOD_TABLE`. `computeMealNutrition` рахує точніше → k зазвичай < 1.5 → масштабування дає ±3%. `adjustDeficientDays` лишається страховкою для крайніх випадків (> 12% дефіцит після scaling).

### Зворотня сумісність
- `AIMeal` тип незмінний — поля `calories/protein/fat/carbs` залишились (тепер рахуються кодом)
- Фронтенд — без змін
- Старі меню в MongoDB — `normalizeMeal` перерахує макро з інгредієнтів при читанні

### Перевірка
- `npx tsc --noEmit` → exit 0
- Після генерації: `days[].totalCalories` ∈ `[goalCalories × 0.97, goalCalories × 1.03]`
- Dev-консоль: `[foodNutrition] no match for ingredient: "..."` → сигнал розширити `FOOD_TABLE`
- `ConsumePortionSheet`: зміна ваги порції → ккал перераховується пропорційно

---

## 🔧 Changelog — Виправлення свопу: інгредієнти в альтернативах + регулювання калорій (2026-06-04)

### Проблеми
1. **LLM повертав альтернативи без інгредієнтів**: промпт `generateMealAlternatives` посилався на `<AIMeal>` без визначення схеми — модель не знала, що потрібне поле `ingredients`. Через це `computeMealNutrition` повертала 0 ккал і масштабування не спрацьовувало.
2. **`totalCalories` дня не оновлювався після свопу**: `swap/route.ts` перезаписував лише страву, а `days[].totalCalories` лишався зі старим значенням до наступного рефетчу меню.

### Зміни

#### 1. Промпт `generateMealAlternatives` — повна схема + цільові калорії
**`src/lib/menu/generateMenuWithAI.ts`**:
- Замінено `<AIMeal>` на явну JSON-схему зі структурою `ingredients` (аналогічно до `SYSTEM_PROMPT` тижневого меню)
- Додано цільову калорійність у промпт: `~${meal.calories} ккал на порцію`; LLM просять регулювати вагу інгредієнтів у грамах для влучення в ціль
- Fallback коли `meal.calories === 0`: орієнтир на `servingSize` г

#### 2. `scaleMealToCalories()` — виділена в окрему exported функцію
**`src/lib/menu/generateMenuWithAI.ts`**:
```ts
export function scaleMealToCalories(meal: AIMeal, targetCalories: number): void
```
- Рахує `k = targetCalories / meal.calories`
- Масштабує `calories`, `protein`, `fat`, `carbs`, `servingSize`, `ingredients[].quantity`
- `шт` → `max(1, round(q × k))`; `г/мл` → `max(5, round(q × k))`
- No-op якщо будь-яке значення = 0, `|k−1| ≤ 3%`, або `k ∉ [0.5, 2.0]`
- Замінює інлайн-блок у `generateMealAlternatives`; використовується і в `swap/route.ts`

#### 3. `swap/route.ts` — масштабування + перерахунок `totalCalories`
**`src/app/api/menu/meal/swap/route.ts`**:
- Після формування `swappedMeal` — виклик `scaleMealToCalories(swappedMeal, originalMeal.calories)` перед записом у БД
- `totalCalories` дня перераховується з усіх страв (consumed + unconsumed) і зберігається в одному `$set` разом зі страваою та `updatedAt`

#### 4. `foodNutrition.ts` — нові продукти
**`src/lib/menu/foodNutrition.ts`**:
- **Кус-кус**: protein 13, fat 1.7, carbs 72 (keywords: `кус-кус`, `кускус`, `кус кус`)
- **Пшенична крупа**: protein 13, fat 2, carbs 68 (keywords: `пшенична крупа`, `пшенична каша` тощо)
- **Курячі грудки** (розширення існуючого запису "Куряче філе"): додано `курячі грудки`, `курячих грудок`, `курячу грудку`

### Перевірка
- `npx tsc --noEmit` → exit 0
- Альтернативи тепер містять `ingredients` → `computeMealNutrition` дає ненульові калорії → `scaleMealToCalories` коректно масштабує
- Після свопу `days[].totalCalories` у MongoDB відразу відповідає сумі страв дня

---

## 🔧 Changelog — Інкрементальна генерація меню (сьогодні → решта тижня частинами) (2026-06-10)

### Проблема
На iPhone (PWA, «Додати на головний екран») генерація меню падала з generic
«Сталася помилка. Перевірте підключення до інтернету.» (`src/app/menu/page.tsx`).
Корінь: **один виклик OpenAI на весь тиждень** (до 3 спроб, до 16384 токенів)
часто наближався/перевищував `maxDuration=60` Vercel Hobby. При перевищенні Vercel
повертає HTML 504, `res.json()` кидає `SyntaxError`, і клієнт показує цю generic
помилку (не справжню причину).

### Рішення
Генерувати лише **сьогоднішній день** синхронно (швидко, ~10-20с — великий запас
до 60с), а решту тижня (до неділі) **догенеровувати окремими фоновими запитами по
≤3 дні**. Дні до сьогодні в поточному тижні (Пн/Вт, якщо сьогодні Ср) пропускаються
повністю — наступного тижня генерація знову почнеться з Понеділка. Весь пост-процесинг
(`computeMealNutrition`, `scaleDayToTarget`, `adjustDeficientDays`, мульти-страви,
рецепти) лишився без змін — він працює над довільним `MenuDay[]`.

### Зміни

#### 1. `weekly_menus` — нове поле
**`src/types/weeklyMenu.ts`**: `pendingDayIndices?: number[]` (0=Пн…6=Нд — дні
поточного тижня, що ще не згенеровані).

#### 2. `generateMenuWithAI` — параметризація по днях
**`src/lib/menu/generateMenuWithAI.ts`**:
- Сигнатура: `generateMenuWithAI(profile, highRated, lowRated, dayIndices = [0..6], priorMeals = [])`.
- `buildPrompt` / `buildSystemPrompt(dayLabels)` тепер просять РІВНО задані дні у
  заданому порядку (раніше жорстко «7 днів, Понеділок–Неділя»).
- `mapDays(rawDays, weekStartDate, targetCalories, dayIndices)` — дата/`dayLabel`
  обчислюються з `dayIndices[i]`, тож часткові партії лягають на правильний день.
- Токени масштабуються per-batch: `TOKENS_PER_DAY = 4000`, кап `MAX_OUTPUT_TOKENS_CAP = 16384`.
- Перевірка довжини відповіді: `parsed.days.length < dayIndices.length` (замість `< 7`).
- Новий хелпер `getTodayWeekdayIndex()` → `(new Date().getDay() + 6) % 7`.
- **`priorMeals`** (НЕ «avoidMeals»): у промпт передаються назви складних страв
  обіду/вечері з уже згенерованих днів з інструкцією, що їх **доречно повторити** на
  1-2 наступні дні поспіль для готування наперед (`isMultiDayPrep`) — багатоденне
  готування працює і через межі батчів. (Снідки/прості страви — різноманітні.)

#### 3. `POST /api/menu/generate` — лише сьогодні
**`src/app/api/menu/generate/route.ts`**: `todayIdx = getTodayWeekdayIndex()`,
генерує `dayIndices = [todayIdx]`, зберігає `pendingDayIndices = [todayIdx+1 … 6]`
(порожній масив, якщо сьогодні Неділя).

#### 4. `POST /api/menu/generate-rest` — новий маршрут
**`src/app/api/menu/generate-rest/route.ts`** (`maxDuration = 60`):
- Auth `checkSessionSubscription()` (401/402). Якщо `pendingDayIndices` порожній → `{ pendingDayIndices: [] }`.
- **Claim до 3 днів з оптимістичним lock'ом**: `updateOne({ _id, pendingDayIndices: pending }, { $set: { pendingDayIndices: remaining } })`; якщо `matchedCount === 0` (паралельний запит уже забрав) → повертає `pending` без генерації.
- Збирає `priorMeals` зі страв обіду/вечері вже згенерованих днів, викликає
  `generateMenuWithAI(profile, [], [], claimed, priorMeals)`.
- При успіху: `$push: { days: { $each: newDays } }` + ре-синк списку покупок
  (`mergeShoppingItems` зберігає purchased-стан і власні товари).
- При помилці — повертає `claimed` назад у `pendingDayIndices` і відповідає 500.
- Відповідь: `{ pendingDayIndices: remaining }`.

#### 5. `shoppingListBuilder` — індекс дня з дати
**`src/lib/menu/shoppingListBuilder.ts`**: `dayIndex` тепер
`(new Date(day.date).getDay() + 6) % 7`, а не позиція в масиві — `quantityByDay`
коректний навіть коли `days` починається не з Понеділка (частковий тиждень).

#### 6. Клієнт — catch-up
**`src/app/menu/page.tsx`**: ефект, що поки `menu.pendingDayIndices?.length`,
шле `POST /api/menu/generate-rest`, потім `fetchMenu()` і повторює (з retry на
помилки, `useRef`-захист від дублів). Банер «🌀 Доганяємо решту тижня…» над
`WeeklyMenuView`. Самовідновлюється при перезавантаженні сторінки з незавершеним меню.

#### 7. Косметика
**`src/components/menuPage/GenerateMenuLoader.tsx`**: «15–30 секунд» → «10–20 секунд».

### Перевірка
- `npx tsc --noEmit` → exit 0
- Генерація: спершу швидко з'являється лише сьогоднішній день (за датою), далі
  автоматично підтягуються наступні по ≤3, `pendingDayIndices` спадає до `[]`.
- Список покупок після кожного підвантаження містить позиції з усіх згенерованих
  днів з правильним `quantityByDay`; purchased-стан зберігається.
- Edge case «сьогодні Неділя»: `pendingDayIndices = []`, без catch-up запитів.
- Залишок: фінальний тест на iPhone PWA (перший виклик має стабільно вкладатись у
  кілька секунд незалежно від мережі).

---

## 🔒 Changelog — OWASP security-аудит: фікс підробки ціни, заголовки, валідація (2026-06-11)

Ручний аудит за категоріями OWASP Top 10 (auth/authz, інʼєкції, витік секретів,
небезпечні дефолти). `npm audit` відпрацював; `semgrep` недоступний у середовищі
(Python-пакет, немає pip/pipx) — натомість ручний огляд коду.

### 🔴 Критичні / Високі

#### 1. Підробка ціни платежу — суму диктував клієнт
`POST /api/liqpay/checkout` брав `amount` із тіла запиту і **підписував його як є**;
callback активував підписку лише за `status`, не звіряючи суму. Юзер міг заплатити
1 ₴ за місячний план.
- **Новий `src/lib/plans.ts`** — єдине серверне джерело цін (`week: 199`, `month: 399`)
  + `isPlanId()`, `getPlanPrice()`. Клієнт використовує лише для відображення.
- `liqpay/checkout/route.ts` — `amount`/`currency` **не читаються з клієнта**, а
  виводяться з `planId` через `PLANS`; невалідний `planId` → 400.
- `liqpay/callback/route.ts` — захист у глибину: якщо підписана LiqPay сума менша за
  ціну плану → активація скасовується (`paymentStatus = 'failed'`) + лог.
- `src/app/payment/plan/page.tsx` — імпортує `PLANS` з `@/lib/plans`, у тіло запиту
  `amount` більше не надсилає (усунено дубльовані ціни).

#### 2. Застаріла Next.js (15.3.8) з активними CVE
`npm install next@15.5.19`. Закрито всі high рантайму (SSRF через middleware,
обхід middleware/proxy в App Router, cache-poisoning, content-injection, RSC DoS).
Залишок audit — транзитивна `postcss` (moderate, build-time CSS) всередині next та
build-залежності `next-pwa` (workbox/rollup/serialize-javascript) — рантайму не
стосуються.

### 🟠 Середні

#### 3. Відсутні security-заголовки
`next.config.ts` — `async headers()` на всі роути: HSTS, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`. CSP
застосовується **лише в production** (у dev ламала б Turbopack/HMR), `'self'` +
дозволений `liqpay.ua` для checkout-форми, `frame-ancestors 'none'`.

#### 4. Onboarding-stub логував PII
`src/app/api/onboarding/route.ts` приймав будь-який JSON і писав `console.log` тіла
(вік/вага/стать/цілі). Переписано на безпечний no-op `{ success: true }` без
парсингу/логування (клієнт `creating-plan` чекає лише `response.ok`).

#### 5. Витік внутрішніх помилок клієнту
`callback`, `subscription/init`, `magic-link/request` повертали `error?.message`
у відповідь. Замінено на generic `'Server error'`; деталі лишаються в `console.error`.

### 🟡 Низькі

#### 6. Перевірка типів body-параметрів (NoSQL-інʼєкція)
**Новий `src/lib/validation.ts`** — `isMealType`, `isNonEmptyString`, `safeItemIndex`.
Окрім id у фільтрах виявлено ширший вектор: `mealType`/`itemIndex` підставлялися в
**Mongo update-path** (`days.X.meals.${mealType}.${itemIndex}…`) без валідації.
Захищено: `meal/consume`, `meal/rate`, `meal/swap` (whitelist `mealType`, безпечний
невідʼємний integer `itemIndex`/`alternativeIndex`, непорожній `dayLabel` → інакше
400); `shopping-list` PATCH (`itemId` має бути рядком); `meal/custom` DELETE
(`entryId`/`dayLabel` — рядки, бо йдуть у `$pull`).

#### 7. Constant-time порівняння підпису
`liqpay/callback` — `expected !== signature` замінено на `crypto.timingSafeEqual`
(`signaturesMatch()` з ранньою перевіркою довжини); timing-leak усунено.

#### 8. AI-роути за активною підпискою
`POST /api/menu/food/parse` витрачав OpenAI лише за валідною сесією, не звіряючи
підписку → прострочений юзер міг генерувати витрати. Переведено на
`checkSessionSubscription()` (401/402). Перевірено решту: `meal/alternatives` вже був
за підпискою; `meal/swap` AI **не викликає** (читає готові `quickAlternatives` +
локальне масштабування); `food-preferences` коштів не витрачає — навмисно лишено на
сесійній авторизації.

### Перевірено й коректно (без змін)
Сесії (httpOnly/secure/sameSite cookie, server-side гарди в кожному роуті);
magic-link (random 32B, зберігається лише хеш, one-time, TTL 20хв, POST-підтвердження);
секрети (`.env` у `.gitignore`, в історії не було); немає `eval`/`dangerouslySetInnerHTML`/
`child_process`; CORS не відкритий (дефолт same-origin); ідемпотентність платежів
(unique-індекс на `signature`).

### Перевірка
- `npx tsc --noEmit` → exit 0 (після обох партій).
- `npm audit --omit=dev`: `next`-специфічні рантайм-CVE зникли (лишилась лише
  транзитивна `postcss`-moderate + build-time next-pwa).

### Відкриті (необовʼязкові, наступний цикл)
- CSP без `nonce` — зараз `script-src 'unsafe-inline'`; за потреби посилити через
  nonce-pipeline.
- `next-pwa` тягне вразливі build-залежності — оновлення лише major-бампом
  (`@ducanh2912/next-pwa`), відкладено.
