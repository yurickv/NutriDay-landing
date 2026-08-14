// src/lib/discount.ts
// 10-хвилинне вікно знижки, яке відкривається скретч-карткою на
// /payment/surprise. Джерело правди — httpOnly-кука, яку ставить
// POST /api/discount: сервер сам рахує дедлайн, клієнт лише відображає
// таймер. Після дедлайну checkout бере повну ціну (див. getPlanPrice).
import type { NextRequest } from 'next/server';

export const DISCOUNT_COOKIE = 'nd_discount_until';
export const DISCOUNT_WINDOW_MS = 10 * 60 * 1000;
/** Кука живе довше за вікно: «згоріла» знижка не відновлюється повторним скретчем. */
export const DISCOUNT_COOKIE_MAX_AGE_S = 24 * 60 * 60;
/** Люфт на межі вікна: оплату, почату за мить до 0:00, не караємо повною ціною. */
export const DISCOUNT_GRACE_MS = 60 * 1000;

export function discountUntilFromCookie(req: NextRequest): number | null {
  const raw = req.cookies.get(DISCOUNT_COOKIE)?.value;
  const until = Number(raw);
  return Number.isFinite(until) && until > 0 ? until : null;
}

export function isDiscountActive(until: number | null, graceMs = 0): boolean {
  return until !== null && Date.now() <= until + graceMs;
}
