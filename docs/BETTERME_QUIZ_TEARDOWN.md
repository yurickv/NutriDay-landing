# Розбір квізу BetterMe (flow 1453) → орієнтир для нового онбордингу NutriDay

Джерело: `https://quiz.betterme.world/first-page-brand-palette?flow=1453`
Дані витягнуті з публічного API конструктора:

- структура флоу — `GET https://api.web-constructor.betterme.world/flows/quiz-flow/1453` (544 KB JSON)
- навігація воронки — `__NEXT_DATA__` на сторінці (`appNavigation.steps`, `generatedSaleFunnel.pagesInfo`)

Дата зняття: 2026-08-07. Це A/B-варіант «brand palette» партнерської воронки BetterMe Plan.

---

## 1. Макро-структура воронки

```
/first-page-brand-palette        вибір статі (єдиний контент 1-ї сторінки) + легальна згода
/generated-questionary-…         ВЕСЬ квіз: 68 кроків (жінки) / 70 кроків (чоловіки)
/email/generated                 збір email
/funnel-prompts                  ім'я
/progress-graph                  графік прогресу
/checkout/generated/betterme-plan  оплата
/signup → upsell → /download
```

Ключове: **вся анкета — це один маршрут із внутрішнім степером**, а не 68 Next.js-сторінок.
Кроки описані декларативно (JSON), умови показу — теж JSON (`conditionRoot` з
`combinator: and/or`). Це те, що дозволяє їм тримати 68 кроків без хаосу в коді.

Два незалежні ланцюги: `structure["0"]` — жінки (68 кроків), `structure["1"]` — чоловіки (70).

Типи кроків: `QUESTION` (`single_select` | `multi_select` | `input`), `INFO_PAGE`, `LOADER`.

**Ритм:** ~50 питань + ~18 інфо/лоадер-екранів. Інформаційний екран вставляється
**кожні 3–5 питань** — саме він несе «що ти отримаєш» і «чому ми питаємо».

---

## 2. Блок харчування (жіночий ланцюг, кроки 28–43)

Це найцінніша для нас частина. Порядок точний.

| # | Крок | Тип | Питання | Варіанти |
|---|------|-----|---------|----------|
| 28 | `/drink_daily` | single | How much water do you drink daily?<br>*підказка: 1 average glass of water is 8 oz or 237 ml* | I only have coffee or tea · About 2 glasses · 2 to 6 glasses · More than 6 glasses |
| 29 | `/sleep_usually_get` | single | How much sleep do you usually get? | <5 год · 5-6 · 7-8 · >8 |
| 30 | `/breakfast` | single | When do you usually have breakfast? | 6-8 am · 8-10 am · 10-12 · I usually skip breakfast |
| 31 | `/lunch` | single | How about lunch? | 10-12 · 12-2 pm · 2-4 pm · I usually skip lunch |
| 32 | `/dinner` | single | What time do you have dinner? | 4-6 pm · 6-8 pm · 8-10 pm · I usually skip dinner |
| 33 | `/diet_type` | single | What type of diet do you prefer? | 10 варіантів, **кожен з поясненням** (див. нижче) |
| 34 | INFO | — | **Get slimmer with a customized meal plan** | мокап телефона зі списком Breakfast 480 kcal · 8 min / Lunch 510 kcal · 20 min / Dinner 435 kcal · 25 min |
| 35 | `/your_bad_habits` | multi | Do you have any of these habits? | Emotional or boredom eating · Overeating · Late-night snacking · Skipping meals too often · None |
| 36 | `/foods_you_crave_most_often` | multi | What foods do you crave most often? | Sweet treats · Salty snacks · Fast food · Soda · None |
| 37 | `/usually_track_your_food` | single | Do you usually track your food? | Yes, every meal · Sometimes, when I remember · No, never |
| 38 | INFO | — | **All your weight loss progress in one place** / **Track your calorie intake effortlessly** | — |
| 39 | `/meals_typically_eat_a_day` | single | How many meals do you typically eat in a day? | <3 · 3 · 3 + snacks · Depends on the day |
| 40 | `/know_about_intermittent_fasting` | single | What do you know about intermittent fasting? | Nothing at all · I've heard a thing or two · I'm an experienced faster |
| 41 | INFO | — | **Lose weight without giving up your favorite foods** | — |
| 42 | `/need_weekend_break_from_fasting` | single | Do you need a weekend break from fasting? | Yes · No · I'll decide later |
| 43 | INFO | — | **We work with top-tier certified experts** | 3 експерти з фото та сертифікаціями, серед них **Registered Dietitian Nutritionist** |

### `/diet_type` — опція з описом (патерн, який варто скопіювати

Кожен варіант має заголовок + пояснення від першої особи:

```
Traditional        — I enjoy everything
Keto               — I prefer high-fat low-carb meals
Paleo              — I don't eat processed foods
Vegetarian         — I avoid meat and fish
Vegan (Plant Diet) — I do not eat animal products
Keto Vegan         — I eat low-carb plant-based meals only
Mediterranean      — I eat plenty of veggies, grains and seafood
Pescatarian        — I avoid meat but enjoy fish
Lactose Free       — I do not consume foods with lactose
Gluten Free        — I avoid gluten-containing grains
```

Юзер не має знати, що таке «палео» — опис знімає когнітивне навантаження.

### Тексти інфо-екранів харчового блоку (варіативні за метою)

**Крок 34 — «Get slimmer with a customized meal plan»** (варіант для мети «схуднути»):
> We tailor meal suggestions to your goal and preferences, so **losing weight feels easier.**
> Improve your eating habits without unhealthy diets or hours in the kitchen.

Для «build muscle»: *…helping you **get stronger with balanced nutrition.***

**Крок 38 — після питання про трекінг:**
> The right calorie balance is crucial for weight loss.
> We'll calculate your daily intake and help **monitor progress in the BetterMe app.**

альтернативний варіант (якщо мета інша):
> You don't need separate apps for workouts, meals, or activity tracking.
> We'll calculate your daily intake and help **monitor progress in the app.**

**Крок 41 — після питання про інтервальне голодування:**
> During intermittent fasting, you focus on **when** you eat.
> It allows you to **enjoy the meals you love** in moderation while still supporting your goal.

Це і є відповідь на «чому ми це питаємо»: питання → одразу екран, який пояснює,
що система зробить із цією відповіддю.

### Чоловічий ланцюг: додатково

Між `/usually_track_your_food` і блоком звичок вставлені два **чутливі** питання —
`/do_you_smoke` (5 варіантів) і `/how_often_do_you_drink_alcohol` (4 варіанти).
Обидва мають чекбокс згоди прямо на екрані питання:

> I consent to BetterMe processing my health onboarding data to provide services
> and enhance my user experience. [Privacy Policy]

Тобто згода на медичні дані береться **точково, на конкретному питанні**, а не одним
загальним чекбоксом на старті.

---

## 3. Числовий блок стоїть у кінці, а не на початку

Кроки 44–47 (жінки): `/height`, `/current_weight`, `/goal_weight`, `/age4` — окремими
екранами, тип `input`, `contentKey`: `heightCm`, `currentWeightKg`, `targetWeightKg`, `age`.

Вік запитують **двічі**: діапазоном на кроці 1 (`18-29 / 30-39 / 40-49 / 50+` — легкий
вхід, нульовий бар'єр) і точним числом на кроці 47, коли юзер уже інвестував 45 кроків.

У нас — навпаки: `/onboarding` одразу вимагає стать + вік + зріст + вагу + активність
на одній сторінці. Це найдорожчий екран, поставлений першим.

---

## 4. Механіки довіри — повний перелік

1. **Соц-доказ на 2-му кроці**, ще до основних питань: «Over 2.7 million women» +
   блок «As featured in» з логотипами медіа.
2. **Реверс персоналізації**: після трьох питань про статуру система «ставить діагноз» —
   *Looks like you have the endomorph body type* + пояснення, що з цим робити.
   Юзер бачить, що відповіді вже працюють.
3. **Wellness profile** (крок 48–49): картка з BMI-шкалою, Body type, Lifestyle,
   Fitness level, Metabolism. Кожен пункт має tooltip з поясненням.
4. **Іменні експерти** з фото та сертифікаціями: `Certified Personal Trainer (NASM)`,
   `Strength & Conditioning Specialist`, `Registered Dietitian Nutritionist`.
5. **Нагороди**: The Best Mobile App Awards 2022 (Health & Fitness), Top-3 Guided
   Workout Apps by Apple 2022, Best Fitness Apps by Forbes Health 2025.
6. **Лоадер із названими етапами аналізу** (12 сек):
   `Your Profile → Activity → Lifestyle & Habits → Nutrition → Weight Goal`.
   Одночасно — карусель відгуків з іменами та 5 зірками.
7. **Графік прогнозу + цитата експерта** з фото і сертифікаціями поруч.
8. **Дисклеймер під прогнозом**, дослівно:
   > *Estimate based on data from active users who followed their plan and logged their
   > progress in the app. Following the exercise and meal plan greatly impacts results.
   > Results may vary. Consult your physician first.*

   І окремо для схуднення: *«In 4 weeks users can typically expect to lose not more than
   1-2 pounds per week»*. Чесне обмеження очікувань **підвищує** довіру.
9. **Точкова згода** на обробку health-даних (див. вище).
10. **Кнопка «SKIP THIS STEP»** на екрані календаря — юзеру дають вихід, а не заганяють.
11. **Питання-зобов'язання**: *How confident are you in reaching [target] by [date]?* —
    змушує сформулювати намір уголос.
12. **Питання-візія**: *At my happy weight, I see myself: Enjoying foods guilt-free /
    Eating more mindfully / …* — емоційна винагорода замість сухих даних.

---

## 5. Технічні прийоми, які варто перенести

- **Змінні в копірайтингу.** Заголовки містять плейсхолдери: `How confident are you in
  reaching [weight|target] by [goalShortTargetDate]?`, `Get a flatter belly at home`
  (генерується з обраних target zones — 60+ комбінацій заголовка на одному екрані).
- **Мова розмітки в текстах**: `[b|жирний]`, `[brBig]` — великий розрив рядка,
  `[themeColor|contentPrimaryColor|текст]` — акцентний колір з теми.
  Тобто копірайтер керує акцентами без коду.
- **Умови показу як дані**, не як `if` у компоненті. Кожен крок має `conditionRoot`
  з `is_any_of` по `questionId`/`answerId`. У нас зараз це `switch` + `router.push`
  у [main-goal/page.tsx](src/app/onboarding/main-goal/page.tsx#L20-L36) — не масштабується.
- **`contentKey`** на питаннях (`goalType`, `dietId`, `fitnessLevel`, `bodyZones`,
  `physicalLimitations`, `heightCm`, …) — стабільний ключ для бекенду, окремий від
  тексту питання. Тексти можна A/B-тестити без міграцій.
- **`analyticsEvent`** на кожному кроці (`/diet_type`, `/your_bad_habits`) —
  готовий funnel-трекінг «з коробки».
- **Тема як дані.** `styleVariables` містить кольори з умовами (для жінок
  `themePrimary: #311E17`, `backgroundSurface: #FFFCF5`; для чоловіків `#EBE1D3` / `#050300`).
  Шрифти: `Gilroy` (основний), `Inter` (вторинний), `answerOptionRadius: 16`,
  `buttonRadius: 24`.

---

## 6. Що це означає для нашого онбордингу

### Поточний стан NutriDay

```
/onboarding (5 полів на одній сторінці: стать, вік, зріст, вага, активність)
 └ /goals → /main-goal → /goal-reason → /additional-goal
     ├ /build-muscle-experience ┐
     ├ /past-experience         ├→ /changes-role-model → /changes-success-factors ┐
     ├ /gain-weight-experience  ┘                                                 │
     └ /past-challenges → /challenges-overcome ────────────────────────────────────┤
   /welcome-new-you → /short-goal → /nutrition-knowledge → /short-barriers ────────┤
                                                                                   ▼
                                              /thank-for-trust → /creating-plan → /payment/plan
```

~12–14 кроків. Один `OnboardingLayout` (заголовок + сірий блок). Жодного інфо-екрана,
жодного соц-доказу, жодного пояснення «навіщо це питання».
Блок харчування зведений до одного питання `/nutrition-knowledge`.

### Розриви відносно завдань, які ти назвав

| Завдання | Розрив |
|---|---|
| Одне питання на сторінку | Порушено лише на `/onboarding` — там 5 полів. Решта вже 1:1. |
| Пояснення «що юзер отримає» | Відсутнє повністю — немає жодного INFO-екрана між питаннями. |
| Пояснення «навіщо це питання» | Відсутнє — `OnboardingLayout` має `subtitle`, але він ніде не використовується. |
| Довіра до сервісу | Відсутня — немає ні соц-доказу, ні експертів, ні дисклеймерів, ні згоди на health-дані. |
| Стилі за бренд-буком | `OnboardingLayout` захардкоджений на `#F5F5F5` / `#676465`, кнопка — червоно-помаранчевий градієнт. |

### Конкретні рекомендації

1. **Перенести числовий блок у кінець.** Стартувати з вікового діапазону (4 кнопки) або
   мети — нульовий бар'єр входу. Зріст/вагу/цільову вагу питати окремими екранами
   після ~10 кроків залученості.
2. **Розгорнути харчовий блок** — зараз це наша профільна тема, а в нас там одне питання.
   Мінімум, який має сенс для генерації меню: тип дієти (з описами), час прийомів їжі,
   кількість прийомів, харчові звички, тяга до продуктів, алергії/непереносимості,
   продукти-виключення, бюджет/час на готування.
3. **Додати INFO-екрани** з ритмом 1 на 3–4 питання. Після харчових питань —
   екран-мокап нашого меню з КБЖУ і часом готування (пряма аналогія кроку 34).
4. **Винести флоу в дані.** Масив кроків з `key / type / title / hint / options /
   contentKey / analyticsEvent / condition`, один рендерер + один степер, замість
   19 сторінок з `switch`-навігацією. Інакше 30–40 кроків стануть некерованими.
5. **Довіра — мінімальний набір для старту**: лічильник користувачів або згенерованих
   меню на 2-му кроці, екран «як ми рахуємо твою норму» з формулою, дієтолог з
   іменем і кваліфікацією, дисклеймер про консультацію з лікарем, точкова згода на
   обробку даних здоров'я на питаннях про хвороби/алергії, лоадер з названими етапами.
6. **Прогрес-бар з групами** — BetterMe показує етапи (Profile / Activity /
   Lifestyle & Habits / Nutrition / Goal). Це знімає тривогу «скільки ще».

---

## 7. Бренд-бук Nutriday — що з нього зобов'язує онбординг

Джерело: [Google Slides](https://docs.google.com/presentation/d/10x-aalJKETrAc7ea9bP7OJwheNq7RE6yw17N3YHVwYM/edit)
(11 слайдів; локальний `docs/Розробка бренд буку Nutriday.pdf` має текст у кривих і не парситься).

### Палітра (слайд 5)

| Група | Токен | HEX | Роль |
|---|---|---|---|
| Основний · Sage | dark | `#56633F` | темний (hover / active) |
| | base | `#7A8A5E` | базовий брендовий |
| | light | `#CCDBB2` | світлий (фон стану) |
| Акцент · Terracotta | dark | `#8C491A` | темний |
| | base | `#C67139` | **акцент дії (CTA)** |
| | light | `#FFC6A5` | світлий |
| Нейтральні | text | `#201E1D` | текст |
| | bg | `#F5EAD8` | фон (крем) |
| | card | `#F9F4ED` | картки |

**Пропорція використання: 60% крем/нейтраль · 30% sage · 10% terracotta.**
Пряма заборона: «Кольори поза токенами системи (нові hex)».

Додатково знайдено у векторах PDF (не підписані в палітрі, але вживані):
`#2E2B25`, `#645C50`, `#82796A` (градації тексту), `#DCD3C4` (бордери),
`#AEBF92`, `#F0FAE1`, `#B23B3B` (негатив/помилка).

### Типографіка (слайд 6)

- **Заголовки — Caprasimo.** H1 56–128px · H2 38–60px · H3 28–32px
- **Текст — Figtree.** Bold 24–28px · Caption 18–20px

### Тон спілкування (слайд 3)

> Легкий, дружній, з [гумором]. Говоримо **як помічник, а не лікар чи тренер-[диктатор]**.

Готові пари ✓/✕ — це фактично готовий копірайтинг для онбордингу:

| ✓ Так | ✕ Ні |
|---|---|
| «Ось твоє меню на [тиждень] — смачно й без зайвих підрахунків» | «Рекомендований КБЖУ становить 1847 ккал» |
| «Список покупок уже [готовий]. Твій час — твій» | «Заповніть усі поля форми для [розрахунку] раціону» |
| «Хочеться піци? Впишемо її в меню разом» | «Заборонені продукти [цього] тижня» |
| «Йо-йо лишаємо для дитинства, не для [ваги]» | «Дисципліна — це все, що вам [потрібно]» |

Позиціонування: *Меню — смачний спосіб життя, а не виснажлива дієта чи покарання за з'їдене.*
Емоційна цінність: *спокій замість [тривоги] за [їжу], впевненість у [виборі] та насолода
різноманітною їжею.* Раціональна: *автоматичний підрахунок калорій і БЖВ, [прості] рецепти
та список покупок за секунду.*

### Робимо / Не робимо (слайд 11)

| Робимо | Не робимо |
|---|---|
| Крем-фон + [м'які] форми та soft-shadows | Стерильний білий фон і [гострі] кути |
| Теплі, "washed" фото їжі й людей | **Складні терміни й цифри без пояснення** |
| Короткі речення, дружній тон | Тиск, [сором], заборони |
| Sage як основний, terracotta як акцент дії | Кольори поза токенами системи |

Рядок «складні терміни й цифри без пояснення» — це прямий мандат на завдання
«пояснення для юзера, навіщо певні питання».

### Слайд 8 — бренд-бук уже описує наш опитувальник

Це найважливіше: макет квізу вже затверджений у бренд-буку.

> **Список питань** · Так [виглядає] опитувальник на лендінгу — крок за кроком,
> дружньо і без тиску.

Специфікація екрана з макета:

```
ПИТАННЯ 2 З 4              ← лічильник кроків, капслок, дрібний

Яка твоя [головна] ціль?   ← Caprasimo, одне питання на екран

[ Схуднути                    ]
[ Підтримати [вагу]           ]   ← крупні картки-відповіді
[ [Наростити] м'язи           ]
[ Просто харчуватись краще    ]

  Назад                 Далі →     ← явна кнопка «Назад»
```

Тобто **«одне питання на сторінку» — не наша ідея, а вимога бренд-буку**, як і
лічильник прогресу та можливість повернутись назад.

### UI-елементи (слайд 7)

- Кнопки: `[Спробу]вати зараз` (primary, terracotta) · `Дізнатися більше` (secondary) ·
  `Пропустити` (ghost) · `Недоступно` (disabled)
- Поле вводу: лейбл «Твоя [вага], кг», значення `68`, помилка «Введіть коректне число»
- Картка страви: фото + «Тепла [каша] з авокадо» + `320 ккал · 15 хв`

Формат `320 ккал · 15 хв` збігається з тим, що BetterMe показує на своєму
meal-plan інфо-екрані (крок 34). Тобто наш власний бренд-бук уже містить
компонент, з якого можна зібрати аналогічний інфо-екран.

### Наслідки для поточного коду

[OnboardingLayout.tsx](src/components/onboardingPage/OnboardingLayout.tsx) зараз повністю
поза брендом: `bg-white`, картка `#F5F5F5` / `#676465`, кнопка — червоно-помаранчевий
градієнт `from-red-500 to-orange-500` у
[CaloriesCalcList.tsx](src/components/onboardingPage/CaloriesCalcList.tsx#L231).
Нема ні лічильника кроків, ні кнопки «Назад», ні крем-фону, ні Caprasimo/Figtree.
Кольори і шрифти варто спершу винести в токени Tailwind, а вже потім переписувати екрани.
