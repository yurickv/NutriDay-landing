# NutriDay — План розробки: Тижневе меню, Список покупок та PWA

> **Статус**: Фаза 1 ✅ | Фаза 2 ✅ | Фаза 3 ✅ | Фаза 4 ✅ | Фаза 5 ✅ | Фаза 6–7 — в черзі
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
      isCompleted: boolean,         // auto-true коли ≥3 з 4 прийомів consumed
      completedAt: Date | null
    }
  ],
  createdAt: Date,
  updatedAt: Date
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
  quickAlternatives: AIMeal[],     // 2 передгенеровані заміни (без доп. AI запиту)

  // Трекінг споживання:
  isConsumed: boolean,             // чи з'їла
  consumedAt: Date | null,

  // Зворотній зв'язок:
  rating: 1 | 2 | 3 | null,       // 😍=3 / 😐=2 / 👎=1
  ratedAt: Date | null
}
```

**Індекс**: `{ userEmail: 1, weekStartDate: -1 }` (compound unique)

> **Важливо**: Окремої колекції `meals` немає — страви вбудовані в `weekly_menus`. При перегенерації старий документ архівується, новий зберігається.

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
      quantity: number,
      unit: string,
      shoppingCategory: ShoppingCategory,
      mealNames: string[],
      forDays: string[],            // ["Понеділок", "Вівторок"] — для фільтру
      isPurchased: boolean,
      purchasedAt: Date | null,     // для conflict resolution при офлайн-синхронізації
      isCustom: boolean
    }
  ],
  updatedAt: Date
}
```

`ShoppingCategory`: `"vegetables" | "fruits" | "meat" | "fish" | "dairy" | "grains" | "legumes" | "oils" | "spices" | "other"`

**Індекс**: `{ userEmail: 1, weeklyMenuId: 1 }` (unique)

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

### `water_logs`

```js
{
  userEmail: string,
  date: Date,             // midnight UTC
  amountMl: number,
  goalMl: number,
  logs: [{ amountMl: number, loggedAt: Date }]
}
```

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
│       │   │   ├── swap/route.ts       ← POST
│       │   │   ├── consume/route.ts    ← PATCH isConsumed
│       │   │   └── rate/route.ts       ← PATCH rating
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
│   │   ├── MealRatingWidget.tsx        ← 3 емодзі після consume
│   │   ├── CalorieProgressBar.tsx      ← sticky
│   │   ├── MacroProgressBar.tsx        ← Б / Ж / В прогрес
│   │   ├── DayMealProgress.tsx         ← "2 з 4 прийомів ✓"
│   │   ├── MultiDayPrepBadge.tsx
│   │   ├── DayPrepTimeBadge.tsx        ← "Швидкий день ⚡" / "Підготовчий 🍳"
│   │   ├── DailyTipCard.tsx
│   │   ├── StreakBanner.tsx
│   │   ├── WaterTracker.tsx
│   │   ├── WeightProgressCard.tsx      ← міні-графік ваги на головній
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
    │   ├── shoppingListBuilder.ts      ← агрегація + forDays
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
| POST | `/api/menu/meal/swap` | Замінити страву |
| PATCH | `/api/menu/meal/consume` | Відмітити страву з'їденою |
| PATCH | `/api/menu/meal/rate` | Рейтинг страви (1/2/3) |
| POST | `/api/menu/complete-day` | Відмітити день |
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
| **MealCard consumed** | Зелена галочка, приглушений колір |
| **DayMealProgress** | "2 з 4 прийомів ✓" під заголовком дня |
| **DayPrepTimeBadge** | "Швидкий день ⚡" (всі ≤20хв) або "Підготовчий 🍳" |
| **CalorieProgressBar** | Sticky зверху, колір: зелений/жовтий/червоний |
| **MacroProgressBar** | Б: Xг/Xг · Ж: Xг/Xг · В: Xг/Xг |
| **WeightProgressCard** | Міні-спарклайн "-1.2 кг за 3 тижні" (тижневий тренд!) |
| **MealRatingWidget** | 😍/😐/👎 — з'являється після відмітки "з'їла" |
| **ServingsSelector** | +/- кнопки в IngredientsTab, пропорційний перерахунок |
| **DayFilterTabs** | Shopping list: "Пн-Ср" / "Чт-Нд" / "Весь тиждень" |
| **OfflineIndicator** | Помаранчева смужка зверху у офлайн-режимі |
| **Toast** | Мотиваційні: без негативу, "Повернулась! Це вже перемога 🎉" при пропуску |
| **Haptic feedback** | Vibration API при consume, rate, streak |
| **Pull-to-refresh** | На головній сторінці меню |
| **Tap targets** | Мін 44×44px для всіх інтерактивних елементів |
| **a11y** | `aria-labels` для емодзі, screen reader для прогрес-барів |
| **Dark mode** | Всі компоненти: `dark:` класи |
| **Кольори** | Orange `#f97316`, Yellow `#f4b619`, Red `#eb3c5a`, тіні `rgba(133,119,123,0.30)` |

---

## PWA налаштування

1. **`public/manifest.json`**:
   - `name: "NutriDay"`, `short_name: "NutriDay"`
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
- 😍/😐/👎 з'являється після відмітки "з'їла" (один тап)
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
- [x] `IOSInstallBanner` — iOS Safari інструкція з кроками → menu/layout.tsx

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

## Критичні файли для змін

| Файл | Зміна | Статус |
|------|-------|--------|
| `src/app/menu/page.tsx` | Замінити заглушку | ✅ Виконано |
| `src/middleware.ts` | Додати `/shopping-list/*`, `/profile/*` | ✅ Виконано |
| `src/app/layout.tsx` | PWA мета-теги | ⏳ Фаза 5 |
| `src/lib/db.ts` | Паттерн для всіх нових API маршрутів | ✅ Використовується |
| `src/lib/auth/session.ts` | `readSessionUserId()` → email | ✅ Без змін (вже повертає email) |
| `src/types/onboarding.ts` | Джерело для `UserProfile` | ✅ UserProfile extends OnboardingData |
| `next.config.ts` | next-pwa конфіг | ⏳ Фаза 5 |
| `.env` | `OPENAI_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | ⚠️ OPENAI_API_KEY — потрібно заповнити |

---

## Верифікація (end-to-end)

1. Авторизуватись → `/menu` → AI генерує меню → перевірити `weekly_menus` в MongoDB
2. Тапнути страву → BottomSheet з рецептом, інгредієнтами, ServingsSelector
3. Swipe right на MealCard → `isConsumed: true`, рейтинг-попап
4. Замінити страву → quickAlternatives (без AI), опція AI fallback
5. Multi-day страва → swap попередження з вибором
6. `/shopping-list` → фільтр по днях, offline: відмітити куплено без інтернету → sync при поверненні
7. Зважитись → графік ваги оновлюється, TDEE перераховується
8. ≥3 прийоми за день → стрік +1 + Toast без негативу
9. Профіль: небажаний продукт → перегенерувати → його немає
10. `goalCalories` ніколи не нижче 1200 ккал
11. Chrome: "Install App" → `display: standalone`
12. iOS: "Додати на головний екран" → без браузерного UI

---

*Документ оновлювати в міру реалізації фаз. Виконані пункти позначати `[x]`.*
