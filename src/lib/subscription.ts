// src/lib/subscription.ts
// Subscription validity: a paid subscription is only valid until its expiry date.
// Previously the app only checked that paymentStatus === 'active' (i.e. that a
// payment ever happened), never WHEN it lapses. These helpers add a real term.
import { getDb } from './db';
import { readSessionUserId } from './auth/session';

export type PlanId = 'week' | 'month';

// Where to send a user without a valid subscription:
//  - returning user (record exists in DB) → payment page to renew
//  - unknown user (no record) → start of onboarding
export const PAYMENT_PAGE = '/payment/plan';
export const ONBOARDING_START = '/onboarding';

export function inactiveRedirectTarget(userExists: boolean): string {
  return userExists ? PAYMENT_PAGE : ONBOARDING_START;
}

/** Subscription length in days per plan. Unknown plans fall back to the shorter (week). */
export function planDurationDays(planId?: string | null): number {
  return planId === 'month' ? 30 : 7;
}

/** expiry = `from` + plan duration. Defaults `from` to now (i.e. the payment moment). */
export function computeSubscriptionExpiry(planId?: string | null, from: Date = new Date()): Date {
  const expiry = new Date(from);
  expiry.setDate(expiry.getDate() + planDurationDays(planId));
  return expiry;
}

interface SubscriptionUser {
  paymentStatus?: string | null;
  subscriptionExpiresAt?: Date | string | null;
}

/** True only when payment is active AND the term has not yet passed. */
export function hasActiveSubscription(user: SubscriptionUser | null | undefined): boolean {
  if (!user) return false;
  if ((user.paymentStatus || '').toLowerCase() !== 'active') return false;
  if (!user.subscriptionExpiresAt) return false;
  return new Date(user.subscriptionExpiresAt).getTime() > Date.now();
}

interface LegacyUser extends SubscriptionUser {
  planId?: string | null;
  updatedAt?: Date | string;
  createdAt?: Date | string;
  lastPayment?: { create_date?: number; end_date?: number } | null;
}

/**
 * Reads the current session's user and reports whether their subscription is valid.
 *
 * Back-compat: users who paid before `subscriptionExpiresAt` existed have no expiry
 * field. Rather than locking them out, we derive an expiry from their last known
 * payment date (LiqPay timestamp → updatedAt → createdAt) + plan duration, persist
 * it once, then evaluate normally.
 */
export async function checkSessionSubscription(): Promise<{
  email: string | null;
  active: boolean;
  userExists: boolean;
}> {
  const email = await readSessionUserId();
  if (!email) return { email: null, active: false, userExists: false };

  const db = await getDb();
  const users = db.collection('users');
  let user = await users.findOne<LegacyUser>({ email });
  const userExists = !!user;

  if (
    user &&
    (user.paymentStatus || '').toLowerCase() === 'active' &&
    !user.subscriptionExpiresAt
  ) {
    const paidMs =
      (user.lastPayment?.create_date && Number(user.lastPayment.create_date)) ||
      (user.updatedAt && new Date(user.updatedAt).getTime()) ||
      (user.createdAt && new Date(user.createdAt).getTime()) ||
      Date.now();
    const expiry = computeSubscriptionExpiry(user.planId, new Date(paidMs));
    await users.updateOne({ email }, { $set: { subscriptionExpiresAt: expiry } });
    user = { ...user, subscriptionExpiresAt: expiry };
  }

  return { email, active: hasActiveSubscription(user), userExists };
}
