// src/lib/plans.ts
// Single source of truth for subscription plans and their prices.
//
// SECURITY: prices live here, on the server, and the checkout/callback routes
// derive the LiqPay `amount` from this map by `planId`. The client must NEVER be
// able to dictate the amount it pays — otherwise a tampered request could buy a
// plan for 1 ₴. The client uses these values only for display.
export type PlanId = 'week' | 'month' | 'quarter';

export interface PlanInfo {
  title: string;
  /** Коротка назва для компактних карток на сторінці оплати. */
  shortTitle: string;
  description: string;
  /** Повна ціна без знижки (whole units, e.g. UAH). */
  amount: number;
  /** Ціна в межах 10-хвилинного вікна знижки (див. src/lib/discount.ts). */
  discountAmount: number;
  /** Розмір знижки у відсотках — лише для відображення. */
  discountPct: number;
  /** Тривалість доступу в днях — і для ціни/день, і для терміну підписки. */
  days: number;
  currency: 'UAH';
}

export const PLANS: Record<PlanId, PlanInfo> = {
  week: {
    title: 'Меню на тиждень',
    shortTitle: 'Тиждень',
    description: 'План харчування на 7 днів з рецептами та списком покупок',
    amount: 398,
    discountAmount: 199,
    discountPct: 50,
    days: 7,
    currency: 'UAH',
  },
  month: {
    title: 'Меню 4 етапами на місяць',
    shortTitle: 'Місяць',
    description: 'Покрокове меню на 4 тижні з рекомендаціями та підтримкою',
    amount: 798,
    discountAmount: 359,
    discountPct: 55,
    days: 30,
    currency: 'UAH',
  },
  quarter: {
    title: 'Меню на 12 тижнів',
    shortTitle: '12 тижнів',
    description: 'Повна програма на 3 місяці: меню, списки покупок і заміни страв',
    amount: 1998,
    discountAmount: 800,
    discountPct: 60,
    days: 84,
    currency: 'UAH',
  },
};

export function isPlanId(v: unknown): v is PlanId {
  return v === 'week' || v === 'month' || v === 'quarter';
}

/** Server-authoritative price for a plan (with or without the discount window). */
export function getPlanPrice(planId: PlanId, discounted = false): number {
  const plan = PLANS[planId];
  return discounted ? plan.discountAmount : plan.amount;
}
