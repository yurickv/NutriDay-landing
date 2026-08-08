# План редизайну сторінки /menu під бренд-бук

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Мета:** привести сторінку `/menu` (і її спільний шелл AppShell/BottomNavBar) до бренд-буку NutriDay — палітра sage/terracotta/крем, шрифти, м'які тіні — прибравши весь легасі-стиль (orange/yellow, «райдужні» картки, білі фони).

**Архітектура:** жодних змін логіки чи API — тільки шар представлення. Спершу створюється фундамент (токени в `@theme` + шрифти), який **шариться з задачею квізу** ([ONBOARDING_QUIZ_SPEC.md](ONBOARDING_QUIZ_SPEC.md), розділ 5), далі компоненти рестайляться групами знизу вгору: шелл → каркас сторінки → картки страв → шіти → віджети → дрібне.

**Стек:** Next.js 15 (App Router), Tailwind CSS 4 (`@theme`), next/font/google, клас-базована темна тема (`.dark` через `ThemeToggle`).

**Референси:**
- Бренд-бук v2 (12 слайдів): [Google Slides](https://docs.google.com/presentation/d/1_WTJD0nM6fcg3x-xhr_CzanWpE6Oe_DJ6BcvoCtsZ68/edit) — палітра/пропорції (сл. 5), типографіка (сл. 6), UI-елементи (сл. 7), темна тема (сл. 8), tone of voice (сл. 3), do/don't (сл. 12). Текст читається через `/export/txt`, hex темної теми — через `/export/pdf`.
- Перший компонент у новому стилі (еталон): [CalorieRingSummary.tsx](../src/components/menuPage/CalorieRingSummary.tsx) (комміт `1532a05`).
- Спека квізу — розділ 5 «Стилі за бренд-буком»: токени звідти і звідси мають бути **одним** блоком у `globals.css`. Хто перший виконується — той створює; друга задача лише споживає.

## Global Constraints

- Мова UI — українська. Існуючі тексти НЕ переписуємо; правки копірайтингу — лише повідомлення про помилки (Таск 3, крок 2), у дружньому тоні на «ти».
- Кольори **тільки з токенів** розділу 1. Нових hex не вводити (сл. 12); напівпрозорість токена (`text-ink/60`, `bg-terracotta-light/20`) — дозволена.
- Темна тема: міняються **лише поверхні і текст** (night-токени); sage/terracotta однакові в обох темах (сл. 8).
- Пропорція 60% крем / 30% sage / 10% terracotta. Семантика акцентів: **sage = стан/прогрес/успіх, terracotta = дія (CTA) і перевищення норми**. Один акцент на екран не перевантажувати.
- Заборонено: чисто білі фони (`bg-white`), гострі кути (мінімум `rounded-xl`), легасі-градієнти `from-*-50 to-*-50`.
- Радіуси: картки `rounded-2xl`, великі summary-блоки/шіти `rounded-3xl` (`rounded-t-3xl` знизу), дрібні контроли `rounded-xl`, чіпи/кружечки `rounded-full`.
- Тінь карток — тільки `shadow-soft` (токен з Таску 1), для модалок допустимий `shadow-2xl`.
- Заголовки: `font-heading` + `font-semibold`/`font-bold` (справжні ваги Comfortaa; `font-extrabold` заборонений — максимум 700). Текст: `font-body` успадковується від AppShell.
- Верифікація після КОЖНОГО таску: `npx tsc --noEmit` (exit 0). **НЕ запускати `next build`, поки працює `next dev`** — build перезаписує `.next/` і dev починає віддавати 500 на всі роути.
- Комміт після кожного таску, стиль існуючий: `feat(menu): …` / `refactor(theme): …`.

---

## 0. Ключові рішення (з обґрунтуванням)

| # | Питання | Рішення |
|---|---------|---------|
| Р1 | Caprasimo і Figtree **не мають кирилиці** (перевірено: обидва тільки latin/latin-ext), а весь UI українською | **Рішення рев'ю 2026-08-08:** повністю кириличні заміни без per-glyph міксів — заголовки **Comfortaa** (округлий геометричний, cyrillic, variable 300–700; пасує до «округлих форм» бренду), текст **Manrope** (cyrillic, variable 200–800). Caprasimo і Figtree в стеках НЕ використовуються й не вантажаться (Caprasimo — опція лише для латинського лого NUTRIDAY при рестайлі лендінгу) |
| Р2 | Іменування токенів: бренд-бук каже «neutral-900/800/100/400», але перевизначення `--color-neutral-*` у `@theme` перефарбувало б УВЕСЬ застосунок (лендінг активно вживає `neutral-*`) | Нові неймспейси без колізій: `cream/card/ink` (світла) + `night/night-card/night-ink/night-muted` (темна). Sage/terracotta — як у спеці квізу |
| Р3 | Стиль запису темної теми: семантичні токени-перемикачі чи явні `dark:`-пари | Явні `dark:`-пари — так уже написані CalorieRingSummary і вся кодова база |
| Р4 | AppShell/BottomNavBar спільні для /menu, /shopping-list, /profile — рестайл шелла зачепить сусідні сторінки | Приймаємо: помаранчевий неб на бренд-сторінці гірший, ніж кремовий шелл навколо ще старих сторінок. Обидві сторінки — наступні в глобальному рестайлі |
| Р5 | «Райдужні» градієнтні картки віджетів (streak помаранч, вода синя, вага фіолетова, порада зелена) | Усі стають однаковими `bg-card` картками з `shadow-soft`; розрізнення — емодзі + один акцент за семантикою (прогрес sage) |
| Р6 | Кольори типів прийомів їжі `SECTION_COLORS` (синій/помаранч/фіолет/зелений у DayView і MealCard) | Видалити обидві мапи повністю. Заголовки секцій — єдиний стиль sage; ккал у картці — напівжирний ink (макет картки на сл. 7: «320 ккал · 15 хв» — спокійний підпис, без кольорового акценту) |
| Р7 | Легасі CSS-змінні `--color-meal-*`, `--color-kcal`, `--color-eaten-*`, `--color-rating-*` | Видалити з `globals.css` у Таску 4 (єдиний споживач — MealCard, перевірено grep-ом) |
| Р8 | Помилки: у бренд-буку без підпису, hex витягнуті з PDF | `--color-danger #b23b3b` (світла) / `--color-danger-dark #e08585` (темна) — уже зафіксовані в пам'яті проєкту і спеці |
| Р9 | Копірайтинг у tone of voice (сл. 3) | **Рішення рев'ю:** чіпаємо лише формулювання помилок (Таск 3, крок 2). Заголовки, сабтайтли, hero-тексти — без змін до окремого копірайтинг-пасу |
| Р10 | PWA: `viewport.themeColor` зараз `#f97316` | Міняємо на пару media-запитів (крем/night) у Таску 1. Іконки PWA (помаранчеві PNG) і `manifest.json` — окремий фоллоу-ап, не тут |

---

## 1. Дизайн-система (фундамент, шариться з квізом)

### 1.1 Токени `@theme` — доповнення до `src/app/globals.css`

```css
/* Бренд-бук NutriDay: слайд 5 (палітра) + слайд 8 (темна тема).
   Спільні для всього застосунку; квіз онбордингу використовує ці ж токени. */
@theme {
  --color-sage-dark: #56633f;
  --color-sage: #7a8a5e;
  --color-sage-light: #ccdbb2;

  --color-terracotta-dark: #8c491a;
  --color-terracotta: #c67139;
  --color-terracotta-light: #ffc6a5;

  --color-ink: #201e1d;    /* основний текст, світла тема */
  --color-cream: #f5ead8;  /* фон сторінки, світла тема */
  --color-card: #f9f4ed;   /* поверхня карток, світла тема */

  --color-night: #2e2b25;       /* фон сторінки, темна (neutral-900 бренд-буку) */
  --color-night-card: #474238;  /* картки, темна (neutral-800) */
  --color-night-ink: #f9f4ed;   /* основний текст, темна (neutral-100) */
  --color-night-muted: #a19786; /* другорядний текст, темна (neutral-400) */

  --color-danger: #b23b3b;
  --color-danger-dark: #e08585; /* помилки на темних поверхнях */

  --shadow-soft: 0 4px 20px rgba(32, 30, 29, 0.06);

  --font-heading: var(--font-comfortaa), sans-serif;
  --font-body: var(--font-manrope), sans-serif;
}
```

Другорядний текст у світлій темі — `text-ink/60` (напівпрозорість, нового hex не вводимо). Хардкод `#645c50` у CalorieRingSummary при рефакторі (Таск 4) замінюється на `text-ink/60`.

### 1.2 Шрифти — `src/app/layout.tsx`

```ts
import { Nunito, Poppins, Comfortaa, Manrope } from 'next/font/google';

const comfortaa = Comfortaa({
  subsets: ['cyrillic', 'latin'], // variable font 300–700
  variable: '--font-comfortaa',
});

const manrope = Manrope({
  subsets: ['cyrillic', 'latin'], // variable font 200–800
  variable: '--font-manrope',
});
```

`<body>` отримує додаткові змінні (Nunito лишається базовим класом до глобального рестайлу):

```tsx
<body className={`${nunito.className} ${poppins.variable} ${comfortaa.variable} ${manrope.variable} antialiased`}>
```

Обидві гарнітури мають справжні ваги (Comfortaa 300–700, Manrope 200–800) — синтез жирності не потрібен. Рецепт заголовка: `font-heading font-bold` (Comfortaa 700; для дрібніших заголовків шітів допустимий `font-semibold` — фінальна вага фіксується на пробі в Таску 1, крок 4). `font-extrabold`/800 на `font-heading` не використовувати — Comfortaa обмежена 700.

### 1.3 Система поверхонь (три шари глибини)

| Шар | Світла | Темна |
|-----|--------|-------|
| Фон сторінки | `bg-cream` | `dark:bg-night` |
| Картка на фоні | `bg-card` + `shadow-soft` | `dark:bg-night-card` |
| Вкладена панель усередині картки/шіта (пресети, степери, рядки альтернатив) | `bg-cream` (повертаємось на тон фону) | `dark:bg-night` |
| Хендли/роздільники | `border-ink/10`, `bg-ink/20` | `dark:border-night-ink/10`, `dark:bg-night-muted/40` |

### 1.4 Рецепти (копіювати як є)

- **Кнопка-дія (primary, CTA):** `bg-terracotta hover:bg-terracotta-dark text-card font-semibold rounded-2xl shadow-soft active:scale-95 transition-all`
- **Кнопка другорядна:** `bg-card dark:bg-night-card border border-sage-light dark:border-sage/40 text-sage-dark dark:text-sage-light rounded-xl active:scale-95 transition-all`
- **Стан «з'їдено/успіх» (бейджі, чекмарки):** текст `text-sage-dark dark:text-sage-light`, заливка `bg-sage-light/40 dark:bg-sage/20`, межа `border-sage-light dark:border-sage/40`
- **М'яке попередження/highlight (було amber):** `bg-terracotta-light/20 dark:bg-terracotta/15 border border-terracotta-light dark:border-terracotta/40 text-terracotta-dark dark:text-terracotta-light`
- **Помилка:** текст `text-danger dark:text-danger-dark`, картка `bg-danger/10 border border-danger/30`
- **Фокус інпутів:** `focus:border-sage focus:ring-2 focus:ring-sage-light/50` (замість помаранчевих)
- **Прогрес-бари:** трек `bg-sage-light/40 dark:bg-night`, заповнення `bg-sage`, перевищення — `bg-terracotta` (як у кільці)
- **Заголовок секції страв:** крапка `bg-sage`, лейбл `text-sage-dark dark:text-sage-light`, лічильник ккал `text-ink/50 dark:text-night-muted`

### 1.5 Глобальний мапінг легасі → бренд (застосовується в усіх тасках)

| Легасі | Бренд |
|--------|-------|
| `bg-white dark:bg-neutral-900` (поверхня) | `bg-card dark:bg-night-card` |
| `bg-neutral-50 dark:bg-neutral-950` (фон) | `bg-cream dark:bg-night` |
| `text-neutral-900 dark:text-neutral-100` | `text-ink dark:text-night-ink` |
| `text-neutral-4xx/5xx` (другорядний) | `text-ink/60 dark:text-night-muted` (слабший — `/40`) |
| `border-neutral-100 dark:border-neutral-800` | `border-ink/10 dark:border-night-ink/10` |
| `bg-main`, `text-main`, `hover:text-main`, `border-main` (#f97316) | terracotta-рецепти за роллю (дія → primary-кнопка; акцент стану → sage) |
| `bg-green-500` (підтвердити/з'їдено) | тумблер стану → `bg-sage border-sage`; кнопка-дія «Зберегти» → primary terracotta |
| `green-*` бейджі/текст успіху | рецепт «з'їдено/успіх» |
| `orange/amber-*` (рейтинг, попередження, фокуси) | рейтинг → terracotta-рецепт highlight; фокуси → sage |
| `red-500`, `#e53935` | `danger`/`danger-dark` |
| `sky/blue-*` (вода, iOS-кроки, info-тост) | sage-родина |
| `purple/pink-*` (вага) | нейтральна картка + sage-акценти |
| градієнти `bg-gradient-to-r from-*-50 to-*-50` | плоский `bg-card` + `shadow-soft` |
| `shadow-[0_2px_8px…]`, разові тіні карток | `shadow-soft` |

---

## 2. Таски

### Таск 1: Токени + шрифти + themeColor (фундамент)

**Files:**
- Modify: `src/app/globals.css` (блок `@theme` з 1.1, base-правило з 1.2)
- Modify: `src/app/layout.tsx` (шрифти з 1.2, `viewport.themeColor`)
- Modify: `src/components/layout/AppShell.tsx:9-11` (`font-body`)

**Interfaces:** *Produces:* усі класи-токени (`bg-cream`, `text-ink`, `shadow-soft`, `font-heading`, `font-body`, …), які споживають Таски 2–7 і задача квізу. Перед виконанням перевірити, чи квіз уже не додав цей блок — тоді лише звірити значення й пропустити крок 1.

- [ ] **Крок 1:** У `globals.css` додати блок з 1.1 одразу ПІСЛЯ існуючого `@theme` (не чіпаючи старі токени — їх ще використовують лендінг/onboarding).
- [ ] **Крок 2:** У `layout.tsx` додати два шрифти з 1.2 та підключити змінні до `<body>`; `viewport.themeColor` замінити на:

```ts
themeColor: [
  { media: '(prefers-color-scheme: light)', color: '#f5ead8' },
  { media: '(prefers-color-scheme: dark)', color: '#2e2b25' },
],
```

(Обмеження: meta слідує за системною темою, а не за `.dark`-тумблером — прийнятно, фіксуємо як відоме.)
- [ ] **Крок 3:** В `AppShell.tsx` до кореневого `div` додати клас `font-body` (текст усіх захищених сторінок переходить на Manrope — прийнято в Р4).
- [ ] **Крок 4 (проба шрифтів):** тимчасово вставити в `menu/page.tsx` рядок `<h1 className="font-heading font-bold text-3xl">Тижневе меню · 1 847 ккал</h1>`, подивитись у браузері в світлій/темній темі; зафіксувати вагу заголовків (700 ↔ 600). Пробний рядок видалити.
- [ ] **Крок 5:** `npx tsc --noEmit` → exit 0. Візуально: /menu рендериться, шрифт тексту змінився.
- [ ] **Крок 6:** Комміт `feat(theme): add brand-book tokens and Comfortaa/Manrope fonts`.

### Таск 2: Шелл — AppShell + BottomNavBar

**Files:**
- Modify: `src/components/layout/AppShell.tsx:9`
- Modify: `src/components/layout/BottomNavBar.tsx:17,27-28`

**Interfaces:** *Consumes:* токени Таску 1.

- [ ] **Крок 1:** AppShell: `bg-neutral-50 dark:bg-neutral-950` → `bg-cream dark:bg-night`.
- [ ] **Крок 2:** BottomNavBar: бар `bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-700` → `bg-card dark:bg-night-card border-t border-ink/10 dark:border-night-ink/10`; активний лінк `text-main` → `text-terracotta dark:text-terracotta-light`; неактивний `text-neutral-400 dark:text-neutral-500 hover:text-main` → `text-ink/40 dark:text-night-muted hover:text-terracotta dark:hover:text-terracotta-light` (рішення рев'ю: актив навігації — terracotta, помітніший; свідомий виняток із правила «terracotta = дія»).
- [ ] **Крок 3:** `npx tsc --noEmit`; візуально в обох темах: кремовий фон, новий неб.
- [ ] **Крок 4:** Комміт `feat(menu): restyle app shell and bottom nav to brand book`.

### Таск 3: Каркас сторінки — page.tsx, лоадер, таби днів

**Files:**
- Modify: `src/app/menu/page.tsx` (усі стани)
- Modify: `src/components/menuPage/GenerateMenuLoader.tsx:21,29`
- Modify: `src/components/common/SkeletonCard.tsx:4,12`
- Modify: `src/components/menuPage/DayTabBar.tsx:47,63-73`

**Interfaces:** *Consumes:* токени/рецепти. *Produces:* нічого нового для інших тасків.

- [ ] **Крок 1 — хедер** (`page.tsx:233-253`): контейнер `bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800` → `bg-card dark:bg-night-card border-b border-ink/10 dark:border-night-ink/10`; `<h1>` → `font-heading font-semibold text-lg text-ink dark:text-night-ink`; сабтайтл → `text-ink/60 dark:text-night-muted`; кнопка «Нове меню» → `text-ink/60 dark:text-night-muted hover:text-terracotta bg-cream dark:bg-night px-3 py-2 rounded-xl transition-colors`.
- [ ] **Крок 2 — копірайтинг помилок** (рішення рев'ю: чіпаємо ЛИШЕ повідомлення про помилки, решту текстів не змінюємо):
  - «Не вдалося завантажити меню. Спробуйте пізніше.» → «Щось пішло не так. Спробуймо ще раз?»
  - «Сталася помилка. Перевірте підключення до інтернету.» → «Немає з'єднання. Перевір інтернет і спробуй ще раз.»
  - setError при незаповненому профілі: «Будь ласка, заповніть профіль перед генерацією меню.» → «Спершу заповни профіль — і зробимо меню під тебе.»
  - Сабтайтл хедера («Ціль: … ккал/день»), «Ваше персональне меню», тексти жовтої картки профілю тощо — БЕЗ змін
- [ ] **Крок 3 — стани** (`page.tsx`):
  - loading: `text-neutral-500` → `text-ink/60 dark:text-night-muted`
  - error: кнопка «Спробувати знову» `bg-main text-white …` → primary-рецепт 1.4
  - no-menu: `<h1>` → `font-heading font-semibold text-ink dark:text-night-ink`; опис → `text-ink/60 dark:text-night-muted`; жовта картка профілю (`bg-yellow-50 … border-yellow-200 …`, текст yellow-800/600, кнопка `bg-yellow-400 hover:bg-yellow-500`) → highlight-рецепт 1.4 + кнопка primary terracotta; червона картка помилки → рецепт «помилка» 1.4; CTA «Згенерувати меню» `bg-main …` → primary-рецепт зі збереженням `px-8 py-4 text-base` і `<Sparkles>`; фіча-плитки `bg-neutral-100 dark:bg-neutral-800` → `bg-card dark:bg-night-card shadow-soft`, підписи → `text-ink/60 dark:text-night-muted`
  - catchingUp-банер (`bg-orange-50 … border-orange-200 …`, текст orange-700/300) → highlight-рецепт 1.4, текст `text-terracotta-dark dark:text-terracotta-light`
- [ ] **Крок 4 — лоадер:** `SkeletonCard.tsx`: обгортка `MealCardSkeleton` `bg-white dark:bg-neutral-900 shadow-sm` → `bg-card dark:bg-night-card shadow-soft`; пульс-блоки `bg-neutral-200 dark:bg-neutral-800` → `bg-ink/10 dark:bg-night-ink/10` (в обох компонентах). `GenerateMenuLoader.tsx`: фейкові таби `bg-neutral-200 dark:bg-neutral-800` → `bg-ink/10 dark:bg-night-ink/10`; заголовок → `font-heading font-semibold`.
- [ ] **Крок 5 — DayTabBar:** контейнер `bg-white dark:bg-neutral-900` → `bg-card dark:bg-night-card`, межа → `border-ink/10 dark:border-night-ink/10`; активний таб `bg-main text-white shadow-md` → `bg-sage text-card shadow-soft`; завершений `bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400` → `bg-sage-light/60 dark:bg-sage/25 text-sage-dark dark:text-sage-light`; кільце «сьогодні» `ring-2 ring-green-500 dark:ring-green-400` → `ring-2 ring-sage dark:ring-sage-light`; чекмарк `text-green-500 dark:text-green-400` → `text-sage-dark dark:text-sage-light`.
- [ ] **Крок 6:** `npx tsc --noEmit`; візуально пройти всі стани: перезавантаження (loading), /menu без меню (заінсценувати не треба — достатньо has-menu + хедер + таби), обидві теми.
- [ ] **Крок 7:** Комміт `feat(menu): restyle page frame, day tabs and loaders to brand book`.

### Таск 4: Картки страв — DayView, MealCard, CustomEntryCard, DayMealProgress (+чистка змінних)

**Files:**
- Modify: `src/components/menuPage/DayView.tsx:12-17,96-104,136-160,276-297`
- Modify: `src/components/menuPage/MealCard.tsx` (уся палітра станів)
- Modify: `src/components/menuPage/CustomEntryCard.tsx:28,40,57`
- Modify: `src/components/menuPage/DayMealProgress.tsx:15-17`
- Modify: `src/components/menuPage/CalorieRingSummary.tsx` (рефактор hex → токени)
- Modify: `src/app/globals.css:32-51` (видалення легасі-змінних)
- Delete: `src/components/menuPage/InputSkeleton.tsx` (порожній 0-байтний файл, ніким не імпортується)

**Interfaces:** *Consumes:* токени/рецепти. Після цього таску `--color-meal-*`, `--color-kcal`, `--color-eaten-*`, `--color-rating-*` не існують (споживач був один — MealCard; перевірено grep-ом).

- [ ] **Крок 1 — DayView:** видалити мапу `SECTION_COLORS` (:12-17) і пропи `color` з `SectionHeader`; `SectionHeader` за рецептом 1.4: крапка `bg-sage`, лейбл `text-sage-dark dark:text-sage-light`, лічильник → `text-ink/50 dark:text-night-muted`. Заголовок дня `<h2>` → `font-heading font-semibold text-ink dark:text-night-ink`; метадані (ккал, час) → `text-ink/60 dark:text-night-muted`; іконка ⚡ `text-yellow-500` → `text-terracotta`; секція «Мої страви»: крапка `bg-neutral-300 dark:bg-neutral-600` → `bg-sage-light dark:bg-sage/40`, лейбл → `text-ink/50 dark:text-night-muted`; кнопка «Додати свою страву» `border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 hover:border-orange-300 hover:text-orange-400` → `border-sage-light dark:border-sage/40 text-ink/50 dark:text-night-muted hover:border-sage hover:text-sage-dark dark:hover:text-sage-light`.
- [ ] **Крок 2 — MealCard:** видалити дубль `SECTION_COLORS` (:22-27) та inline `style={{ color: sectionColor }}` на ккал (:139) — ккал стає `font-semibold text-ink dark:text-night-ink`, решта макро-рядка `text-ink/60 dark:text-night-muted`. Картка нез'їдена `bg-white … dark:bg-neutral-900 …` + разові тіні (:114-115) → `bg-card dark:bg-night-card shadow-soft`; з'їдена `bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900` → `bg-sage-light/30 dark:bg-sage/15 border-sage-light dark:border-sage/40`. Бейдж «замінено» amber (:162) → highlight-рецепт 1.4. Бейдж «з'їдено» на `var(--color-eaten-*)` (:170-172) → рецепт «успіх» 1.4 явними класами. Кнопка-чек consume `bg-green-500 border-green-500` (:225) → `bg-sage border-sage` (тумблер стану, не CTA). Активний рейтинг `text-orange-500 bg-orange-50 border-orange-200 …` (:201) → `text-terracotta bg-terracotta-light/30 border-terracotta-light dark:bg-terracotta/15 dark:border-terracotta/40`. Акордеон рейтингу на `var(--color-rating-*)` (:241-242) → `bg-terracotta-light/15 dark:bg-terracotta/10 border-terracotta-light/60 dark:border-terracotta/30`. Нейтральні тексти — за мапінгом 1.5.
- [ ] **Крок 3 — CustomEntryCard:** картка `bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 shadow-sm` → `bg-card dark:bg-night-card border-sage-light dark:border-sage/40 shadow-soft`; ккал `text-main` → `font-semibold text-ink dark:text-night-ink`; delete-hover `hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20` → `hover:text-danger dark:hover:text-danger-dark hover:bg-danger/10`.
- [ ] **Крок 4 — DayMealProgress:** `text-green-500` (іконка й лейбл) → `text-sage-dark dark:text-sage-light`.
- [ ] **Крок 5 — CalorieRingSummary (рефактор без зміни вигляду):** `bg-[#f9f4ed] dark:bg-[#474238]` → `bg-card dark:bg-night-card`; `text-[#201e1d] dark:text-[#f9f4ed]` → `text-ink dark:text-night-ink`; `text-[#645c50] dark:text-[#a19786]` → `text-ink/60 dark:text-night-muted`; `bg-[#ccdbb2] dark:bg-[#2e2b25]` / `stroke-[#ccdbb2] dark:stroke-[#2e2b25]` → `bg-sage-light dark:bg-night` / `stroke-sage-light dark:stroke-night`; тінь → `shadow-soft`; JS-константи `SAGE`/`TERRACOTTA` → `'var(--color-sage)'`/`'var(--color-terracotta)'` в іменованих константах; велике число кільця → `font-heading font-bold` замість `font-extrabold` (Comfortaa обмежена 700). Прибрати застарілий коментар про hex.
- [ ] **Крок 6 — чистка globals.css:** видалити з `:root` і `.dark` змінні `--color-meal-breakfast/lunch/dinner/snack`, `--color-kcal`, `--color-rating-bg/border`, `--color-eaten-bg/text/border`. Видалити порожній `src/components/menuPage/InputSkeleton.tsx`.
- [ ] **Крок 7:** `grep -rn "color-meal\|color-kcal\|color-eaten\|color-rating" src/` → 0 збігів. `npx tsc --noEmit` → exit 0. Візуально: день зі з'їденими/незʼїденими стравами, рейтинг, кастомна страва — обидві теми.
- [ ] **Крок 8:** Комміт `feat(menu): restyle meal cards and day view, drop legacy meal color vars`.

### Таск 5: Шіти — BottomSheet і все, що на ньому

**Files:**
- Modify: `src/components/common/BottomSheet.tsx:17-34`
- Modify: `src/components/menuPage/MealDetailSheet.tsx:25,47,53`
- Modify: `src/components/menuPage/RecipeTab.tsx:36-37`
- Modify: `src/components/menuPage/IngredientsTab.tsx:21,29,38,62,82`
- Modify: `src/components/menuPage/ConsumePortionSheet.tsx:69-120`
- Modify: `src/components/menuPage/AddCustomFoodSheet.tsx` (фокуси, CTA, нотатки)
- Modify: `src/components/menuPage/SwapMealPanel.tsx:87,98`
- Modify: `src/components/menuPage/MealRatingWidget.tsx:45-59`

**Interfaces:** *Consumes:* токени/рецепти; система вкладених поверхонь 1.3 (панелі всередині шіта — `bg-cream dark:bg-night`).

- [ ] **Крок 1 — BottomSheet:** панель `bg-white dark:bg-neutral-900` → `bg-card dark:bg-night-card` (радіуси лишаються `rounded-t-3xl sm:rounded-3xl`); хендл `bg-neutral-300 dark:bg-neutral-600` → `bg-ink/20 dark:bg-night-muted/40`; межа хедера й close-hover — за мапінгом 1.5; заголовок шіта → `font-heading font-semibold`.
- [ ] **Крок 2 — MealDetailSheet:** активний таб `text-main border-b-2 border-main` → `text-sage-dark dark:text-sage-light border-b-2 border-sage`; межі → 1.5.
- [ ] **Крок 3 — RecipeTab:** amber-нотатка мультиприготування → highlight-рецепт 1.4.
- [ ] **Крок 4 — IngredientsTab:** панель порцій і макро-плитки → вкладена поверхня `bg-cream dark:bg-night`; степери `bg-white dark:bg-neutral-700 shadow` → `bg-card dark:bg-night-card shadow-soft`; роздільники рядків → 1.5.
- [ ] **Крок 5 — ConsumePortionSheet:** активний пресет `bg-main text-white` → `bg-sage text-card` (вибір = стан); неактивні пресети/степер-панель → вкладена поверхня 1.3; ккал-рідаут `text-main` → `text-terracotta font-semibold`; кнопка «Підтвердити» `bg-green-500 text-white` → primary-рецепт 1.4 (це дія).
- [ ] **Крок 6 — AddCustomFoodSheet:** усі `focus:border-orange-400`/`focus-within:border-orange-400` (7 місць: :277, :279, :333, :342, :363, :365, :451) → фокус-рецепт 1.4; «Розрахувати» `bg-main` і «Зберегти» `bg-green-500` → primary-рецепт; amber-примітка (:322) → highlight-рецепт; delete-hover `hover:text-red-500` → `hover:text-danger dark:hover:text-danger-dark`; add-hover `hover:text-orange-500` → `hover:text-sage-dark dark:hover:text-sage-light`; степери → як у кроці 4; uppercase-лейбли (:254, :443) → `text-ink/50 dark:text-night-muted` (uppercase лишити — це дрібна службова типографіка).
- [ ] **Крок 7 — SwapMealPanel:** текст помилки `text-red-500` → `text-danger dark:text-danger-dark`; рядки альтернатив `bg-neutral-50 dark:bg-neutral-800 hover:border-main` → `bg-cream dark:bg-night hover:border-sage` (+ `border border-transparent`, щоб hover не стрибав, якщо межі нема).
- [ ] **Крок 8 — MealRatingWidget:** панель `bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl` → `bg-card dark:bg-night-card rounded-3xl shadow-2xl`; заголовок → `font-heading font-semibold`; емодзі-кнопки hover → `hover:bg-cream dark:hover:bg-night`.
- [ ] **Крок 9:** `npx tsc --noEmit`; візуально: відкрити деталі страви (обидва таби), порцію, заміну, додавання своєї страви, рейтинг — обидві теми.
- [ ] **Крок 10:** Комміт `feat(menu): restyle bottom sheets to brand book`.

### Таск 6: Віджети — Streak, Вода, Вага, Порада (де-райдужнення)

**Files:**
- Modify: `src/components/menuPage/StreakBanner.tsx:35-99`
- Modify: `src/components/menuPage/WaterTracker.tsx:13,32-75`
- Modify: `src/components/menuPage/WeightProgressCard.tsx:15,33-120`
- Modify: `src/components/menuPage/DailyTipCard.tsx:31,38-44`

**Interfaces:** *Consumes:* токени/рецепти. Спільний патерн картки віджета: `bg-card dark:bg-night-card rounded-2xl shadow-soft` без градієнтів і кольорових меж (Р5).

- [ ] **Крок 1 — StreakBanner:** градієнт+межа (:35) → патерн картки віджета; «рекорд» `text-main` → `text-terracotta`; роздільник orange → `border-ink/10 dark:border-night-ink/10`; «Бейдж розблоковано» orange → `text-terracotta-dark dark:text-terracotta-light`; прогрес до бейджа: трек `bg-orange-100 dark:bg-orange-900/40` → `bg-sage-light/40 dark:bg-night`, заповнення `bg-gradient-to-r from-orange-400 to-yellow-400` → `bg-sage`.
- [ ] **Крок 2 — WaterTracker:** градієнт (:32) → патерн картки віджета; «ціль досягнута» green → `text-sage-dark dark:text-sage-light`; трек `bg-sky-100 dark:bg-sky-900/40` → `bg-sage-light/40 dark:bg-night`; заповнення (три пороги :59-62) → одне `bg-sage` (при 100% — `bg-sage-dark`); кнопки порцій `bg-white dark:bg-neutral-800 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300` → другорядна кнопка 1.4; скелетон → `bg-ink/10 dark:bg-night-ink/10`.
- [ ] **Крок 3 — WeightProgressCard:** градієнт (:42) → патерн картки віджета; `deltaColor`: схуднення → `text-sage-dark dark:text-sage-light`, набір → `text-terracotta` (TODO-фоллоу-ап: семантика залежить від цілі юзера — поза скоупом); «+ Додати» purple-кнопка → другорядна кнопка 1.4; спарклайн `bg-purple-300 dark:bg-purple-700` → `bg-sage-light dark:bg-sage/40`; роздільник purple → `border-ink/10 dark:border-night-ink/10`; інпути `border-purple-200 … focus:ring-purple-300` → фокус-рецепт 1.4 + `bg-card dark:bg-night-card`; «Зберегти» `bg-purple-500 text-white` → primary-рецепт (дія); скелетон → як у кроці 2.
- [ ] **Крок 4 — DailyTipCard:** градієнт (:38) → патерн картки віджета; лейбл категорії green → `text-sage-dark dark:text-sage-light`; скелетон → як у кроці 2.
- [ ] **Крок 5:** `npx tsc --noEmit`; візуально: чотири віджети більше не «райдуга», обидві теми.
- [ ] **Крок 6:** Комміт `feat(menu): unify engagement widgets on brand card style`.

### Таск 7: Дрібне — Toast, InstallBanner, фінальна зачистка

**Files:**
- Modify: `src/components/common/Toast.tsx:32-44`
- Modify: `src/components/common/InstallBanner.tsx:53-118`

**Interfaces:** *Consumes:* токени/рецепти.

- [ ] **Крок 1 — Toast:** error `bg-red-500` → `bg-danger text-card`; info `bg-blue-500` → `bg-sage text-card`; дефолт `bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900` → `bg-ink text-card dark:bg-card dark:text-ink`.
- [ ] **Крок 2 — InstallBanner:** картка `bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700` → `bg-card dark:bg-night-card border-ink/10 dark:border-night-ink/10` (і стрілка-ромбик :118 тим самим); заглушка іконки `style={{ background: '#f97316' }}` → `background: 'var(--color-terracotta)'` (сама PNG-іконка застосунку лишається помаранчевою до фоллоу-апу PWA-іконок); CTA `bg-orange-500 hover:bg-orange-600` → primary-рецепт 1.4; iOS-кроки `bg-blue-50 dark:bg-blue-900/30` + `text-blue-500` → `bg-sage-light/30 dark:bg-sage/20` + `text-sage-dark dark:text-sage-light`; inline `boxShadow` → прибрати, замінити класом `shadow-soft` (плюс наявний `shadow-xl` прибрати).
- [ ] **Крок 3 — фінальна зачистка (grep-гейт):** нуль збігів у кожній команді:

```bash
grep -rnE "(bg|text|border|ring|from|to|stroke|fill)-(main|orange|amber|yellow|sky|blue|purple|pink|emerald|green|red)-?" src/components/menuPage src/components/layout src/app/menu/page.tsx
grep -rnE "bg-white|(bg|text|border|ring)-neutral-" src/components/menuPage src/components/layout src/app/menu/page.tsx
grep -rnE "#(3B82F6|F97316|8B5CF6|10B981|f97316)" src/components/menuPage src/components/layout
grep -rnE "text-main|bg-main" src/components/common/Toast.tsx src/components/common/BottomSheet.tsx src/components/common/InstallBanner.tsx src/components/common/SkeletonCard.tsx
```

- [ ] **Крок 4 — повна верифікація:** `npx tsc --noEmit` → exit 0; `npm test` → зелений (аналітичні сюїти UI не чіпають — регресій бути не має); візуальний прохід у браузері: has-menu день (картки, кільце, віджети), усі 4 шіти, тости, InstallBanner (можна тимчасово почистити `sessionStorage.nd_install_dismissed`), світла + темна тема, вьюпорт 390px.
- [ ] **Крок 5:** Комміт `feat(menu): finish brand-book restyle (toasts, install banner, cleanup)`.

---

## 3. Поза скоупом (фоллоу-апи, НЕ робити тут)

1. **PWA-іконки й manifest.json** — помаранчеві PNG (`icon-192/512`, apple-touch-icon), `theme_color` у маніфесті → перегенерувати в terracotta/sage при глобальному рестайлі.
2. **/shopping-list і /profile** — контент цих сторінок (шелл уже стане брендовим після Таску 2).
3. **Лендінг + onboarding** — лендінг лишається на старих токенах (`--color-main*` НЕ видаляти з `@theme`, поки живий); onboarding переписує задача квізу.
4. **Кольори дельти ваги за ціллю юзера** (для `gain_weight` набір ваги — успіх) — окрема задачка з даними профілю.
5. **Заміна `.dark`-мета themeColor на динамічну** (слідувати тумблеру, а не системі).
6. **Шрифт лендінгу** — Nunito на `<body>` лишається, доки лендінг не рестайлиться.

## 4. Рішення рев'ю (2026-08-08) — питання закриті, план готовий до виконання

1. **Шрифти:** Comfortaa (заголовки) + Manrope (текст); Caprasimo/Podkova/Onest у стеках не використовуються. Вага заголовків (700 ↔ 600) фіксується на пробі — Таск 1, крок 4.
2. **Активний пункт нижньої навігації:** terracotta (у темній темі — terracotta-light).
3. **Шелл (Р4):** підтверджено — /shopping-list і /profile тимчасово отримують кремовий фон + новий неб + шрифт Manrope при старому контенті.
4. **Копірайтинг:** лише дружні формулювання помилок (Таск 3, крок 2); решта текстів без змін.
