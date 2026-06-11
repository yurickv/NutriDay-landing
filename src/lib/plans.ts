// src/lib/plans.ts
// Single source of truth for subscription plans and their prices.
//
// SECURITY: prices live here, on the server, and the checkout/callback routes
// derive the LiqPay `amount` from this map by `planId`. The client must NEVER be
// able to dictate the amount it pays — otherwise a tampered request could buy a
// plan for 1 ₴. The client uses these values only for display.
export type PlanId = 'week' | 'month';

export interface PlanInfo {
  title: string;
  description: string;
  /** Price in the plan currency (whole units, e.g. UAH). */
  amount: number;
  currency: 'UAH';
}

export const PLANS: Record<PlanId, PlanInfo> = {
  week: {
    title: 'Меню на тиждень',
    description: 'План харчування на 7 днів з рецептами та списком покупок',
    amount: 199,
    currency: 'UAH',
  },
  month: {
    title: 'Меню 4 етапами на місяць',
    description: 'Покрокове меню на 4 тижні з рекомендаціями та підтримкою',
    amount: 399,
    currency: 'UAH',
  },
};

export function isPlanId(v: unknown): v is PlanId {
  return v === 'week' || v === 'month';
}

/** Server-authoritative price for a plan. */
export function getPlanPrice(planId: PlanId): number {
  return PLANS[planId].amount;
}
