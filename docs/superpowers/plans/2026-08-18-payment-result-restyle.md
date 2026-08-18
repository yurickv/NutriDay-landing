# Payment Result Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Привести `/payment/result` до бренд-стилю Sytno (становий дизайн, як у квізі), не торкаючись логіки.

**Architecture:** Один клієнтський файл `src/app/payment/result/page.tsx`; змінюється лише JSX return-блок `PaymentResultContent` + рядок імпортів (додаються lucide-іконки). Уся логіка (полінг, magic-link, аналітика, стани) — байт-у-байт.

**Tech Stack:** Next.js 15, React 19, Tailwind 4 (бренд-токени з globals.css @theme), lucide-react.

**Spec:** `docs/superpowers/specs/2026-08-18-payment-result-restyle-design.md`

## Global Constraints

- Змінюється ЛИШЕ `src/app/payment/result/page.tsx`. Логіка (усі hooks, requestMagicLink, analytics-ефекти, Suspense) — недоторкана; правки лише в return-блоці та імпортах.
- Тексти message useMemo — дослівно як є; нові заголовки станів: «Оплата успішна!» / «Оплата не пройшла» / «Очікуємо підтвердження оплати…».
- НЕ запускати `next build`, поки працює dev. Тип-чек: `npx tsc --noEmit`.
- Коміт із trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Рестайл return-блоку PaymentResultContent

**Files:**
- Modify: `src/app/payment/result/page.tsx` (імпорти + return-блок, рядки ~222–319)

**Interfaces:**
- Consumes: наявні стани компонента (`isPaid`, `isFailed`, `message`, `orderId`, `effectiveStatus`, `polling`, `resolvedEmail`, `magicSending`, `magicSent`, `magicError`, `requestMagicLink`, `router`); бренд-токени Tailwind (`sage*`, `terracotta*`, `ink`, `night*`, `danger*`, `font-heading`, `shadow-soft`).
- Produces: нічого нового назовні — лише розмітка.

- [ ] **Step 1: Додати іконки до імпортів**

У `src/app/payment/result/page.tsx` після рядка `import Link from 'next/link';` додати:

```tsx
import { Check, X, Loader2 } from 'lucide-react';
```

- [ ] **Step 2: Замінити return-блок**

Замінити ВЕСЬ return-блок функції `PaymentResultContent` (від `return (` з `<OnboardingLayout` до закривної `);` перед закривною дужкою функції) на:

```tsx
  return (
    <OnboardingLayout>
      <div className="flex flex-col gap-8">
        {/* Становий блок: іконка + заголовок + повідомлення */}
        <div className="flex flex-col items-center gap-4 text-center">
          {isPaid ? (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sage/15 text-sage-dark dark:bg-sage/25 dark:text-sage-light">
              <Check className="h-8 w-8" />
            </span>
          ) : isFailed ? (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger dark:bg-danger/20 dark:text-danger-dark">
              <X className="h-8 w-8" />
            </span>
          ) : (
            <Loader2 className="h-12 w-12 animate-spin text-sage" aria-hidden />
          )}
          <h1 className="font-heading text-2xl font-bold md:text-3xl">
            {isPaid
              ? 'Оплата успішна!'
              : isFailed
                ? 'Оплата не пройшла'
                : 'Очікуємо підтвердження оплати…'}
          </h1>
          <p className="text-ink/80 dark:text-night-ink/80">{message}</p>

          {isPaid && (
            <p className="text-sm leading-relaxed text-ink/70 dark:text-night-ink/70">
              Ми надіслали лист із магічним посиланням для входу у ваш кабінет
              {resolvedEmail && (
                <>
                  {' '}
                  на <span className="font-semibold">{resolvedEmail}</span>
                </>
              )}
              . Відкрийте лист і перейдіть за посиланням, щоб увійти.
            </p>
          )}

          {magicSent && (
            <p className="text-xs text-sage-dark dark:text-sage-light">
              Лист для входу надіслано. Якщо його немає, перевірте папку
              «Спам».
            </p>
          )}

          {magicError && (
            <p className="text-xs text-danger dark:text-danger-dark">
              {magicError}
            </p>
          )}
        </div>

        {/* Кнопки в стилі квізу: primary terracotta + secondary outline */}
        <div className="mx-auto flex w-full max-w-[440px] flex-col gap-3">
          {isPaid ? (
            <>
              <Link
                href="/menu"
                className="rounded-2xl bg-terracotta px-6 py-4 text-center font-heading font-bold text-white shadow-soft transition-colors hover:bg-terracotta-dark"
              >
                Перейти в меню
              </Link>
              <button
                type="button"
                disabled={magicSending}
                onClick={() => requestMagicLink(false)}
                className={`rounded-2xl border-2 border-ink/15 px-6 py-3 text-center font-semibold transition-colors hover:bg-sage-light/30 dark:border-night-ink/15 dark:hover:bg-night-card ${
                  magicSending ? 'cursor-not-allowed opacity-70' : ''
                }`}
              >
                {magicSending
                  ? 'Надсилаємо лист...'
                  : 'Надіслати лист для входу ще раз'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => router.push('/payment/plan')}
                className="rounded-2xl bg-terracotta px-6 py-4 text-center font-heading font-bold text-white shadow-soft transition-colors hover:bg-terracotta-dark"
              >
                Спробувати оплатити ще раз
              </button>
              <Link
                href="/menu"
                className="rounded-2xl border-2 border-ink/15 px-6 py-3 text-center font-semibold transition-colors hover:bg-sage-light/30 dark:border-night-ink/15 dark:hover:bg-night-card"
              >
                Перейти в меню
              </Link>
            </>
          )}
        </div>

        {/* Технічні деталі транзакції */}
        <div className="border-t border-ink/10 pt-4 text-center text-xs text-ink/50 dark:border-night-ink/10 dark:text-night-muted">
          {orderId && (
            <div>
              Номер замовлення: <span className="font-mono">{orderId}</span>
            </div>
          )}
          <div>
            Статус платежу:{' '}
            <span className="font-semibold">
              {effectiveStatus || 'невідомо'}
              {polling &&
              ![
                'success',
                'subscribed',
                'failure',
                'error',
                'active',
                'reversed',
                'cancelled',
                'canceled',
                'failed',
              ].includes(effectiveStatus)
                ? ' (оновлюємо...) '
                : ''}
            </span>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  );
```

УВАГА: вище за return-блок НІЧОГО не міняти — всі hooks/функції лишаються, включно з умовою показу «(оновлюємо...)», яка скопійована дослівно.

- [ ] **Step 3: Тип-чек і перевірка залишків старого стилю**

Run: `npx tsc --noEmit && grep -n "orange\|gray-\|bg-white\|dark-body\|green-7\|red-6" src/app/payment/result/page.tsx || echo "clean"`
Expected: tsc exit 0; grep → `clean` (жодного старого класу).

- [ ] **Step 4: Dev-смоук трьох станів**

Порт 3000 має бути вільний. Запустити `npm run dev` у фоні, дочекатись готовності, потім:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/payment/result?status=success&order_id=ND-test-1"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/payment/result?status=failure&order_id=ND-test-1"
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/payment/result"
```
Expected: три рази 200 (стани клієнтські — заголовків у SSR HTML не видно, це нормально). ОБОВ'ЯЗКОВО зупинити dev-сервер, порт звільнити. Візуальний прогін трьох станів у браузері — на користувача.

- [ ] **Step 5: Commit**

```bash
git add src/app/payment/result/page.tsx
git commit -m "feat(payment): restyle result page to brand design — state-driven layout

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
