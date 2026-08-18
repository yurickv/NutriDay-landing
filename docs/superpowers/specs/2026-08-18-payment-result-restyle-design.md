# Рестайл /payment/result під бренд-бук Sytno

**Дата:** 2026-08-18
**Статус:** затверджено користувачем

## Мета

Привести сторінку результату оплати (`src/app/payment/result/page.tsx`) до нового
бренд-стилю (sage/terracotta/cream, Comfortaa/Manrope) — як увесь опитувальник.
Зараз усередині картки лишився старий orange-стиль: `bg-white`, сірі тексти,
кнопки `orange-500`, generic-бордери.

## Незмінне (жорсткі межі)

- Уся логіка байт-у-байт: полінг `/api/subscription/status` + `/api/liqpay/status`,
  авто-надсилання magic-link, `requestMagicLink`, analytics-події
  (`payment_succeeded`/`payment_failed`, identify), Suspense-обгортка, стани
  isPaid/isFailed/effectiveStatus.
- Тексти `message` useMemo — дослівно.
- Змінюється ЛИШЕ `src/app/payment/result/page.tsx` (JSX/класи/іконки) —
  жодних правок в OnboardingLayout чи інших файлах.

## Рішення

1. **Хедер**: прибрати пропси `title="Результат оплати"` / `subtitle="Статус
   транзакції в LiqPay"` з OnboardingLayout — заголовок стає становим усередині
   картки (OnboardingLayout без title не рендерить hero-секцію взагалі).
2. **Становий блок** у картці (`bg-card` вже дає layout):
   - Успіх (`isPaid`): іконка `Check` (lucide) у колі `bg-sage/15 text-sage-dark
     dark:bg-sage/25 dark:text-sage-light` (h-16 w-16, іконка h-8 w-8), заголовок
     `font-heading text-2xl font-bold` «Оплата успішна!», текст message
     (`text-ink/80`), блок про лист magic-link (`text-ink/70`, email —
     `font-semibold`), «лист надіслано» — `text-sage-dark dark:text-sage-light`,
     помилка листа — `text-danger dark:text-danger-dark`.
   - Помилка (`isFailed`): іконка `X` у колі `bg-danger/10 text-danger
     dark:bg-danger/20 dark:text-danger-dark`, заголовок «Оплата не пройшла».
   - Очікування (інше): `Loader2` `animate-spin text-sage` (без кола), заголовок
     «Очікуємо підтвердження оплати…».
   - Іконка + заголовок + текст — по центру (`text-center`, `mx-auto`).
3. **Кнопки** — стовпчик по центру `mx-auto w-full max-w-[440px] flex flex-col gap-3`:
   - Primary (стиль QuizCta): `rounded-2xl bg-terracotta px-6 py-4 text-center
     font-heading font-bold text-white shadow-soft transition-colors
     hover:bg-terracotta-dark`. Успіх → «Перейти в меню» (Link /menu);
     помилка/очікування → «Спробувати оплатити ще раз» (router.push /payment/plan).
   - Secondary outline: `rounded-2xl border-2 border-ink/15 px-6 py-3 text-center
     font-semibold transition-colors hover:bg-sage-light/30
     dark:border-night-ink/15 dark:hover:bg-night-card`. Успіх → «Надіслати лист
     для входу ще раз» (disabled-стан `opacity-70 cursor-not-allowed` під час
     надсилання); помилка/очікування → «Перейти в меню».
4. **Технічний рядок** унизу картки, під `border-t border-ink/10
   dark:border-night-ink/10 pt-4`: номер замовлення (`font-mono`) і сирий статус
   з «(оновлюємо...)» — `text-xs text-ink/50 dark:text-night-muted`. Логіка
   показу «(оновлюємо...)» (polling && статус не фінальний) — як була.
5. Іконки з `lucide-react` (вже в проєкті). Темна тема — наявними night-токенами.

## Верифікація

`npx tsc --noEmit`; dev-прогін трьох станів: `?status=success&order_id=ND-test-1`,
`?status=failure&order_id=ND-test-1`, без параметрів (очікування, полінг), світла
тема (headless curl: перевірити наявність станових заголовків у HTML не вийде —
сторінка клієнтська, стани залежать від query на клієнті; перевіряється
рендер 200 + відсутність orange/gray класів у файлі grep'ом).

## Ризики

Мінімальні: логіка не чіпається; сторінка після оплати — фінальний
браузерний прохід користувача (як і для решти перф-гілки).
