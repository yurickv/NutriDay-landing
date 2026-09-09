import { describe, it, expect } from 'vitest';
import { buildPaymentCaptureArgs, deterministicUuid } from './posthog.server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('deterministicUuid', () => {
  it('is stable for the same input and shaped like a v5 UUID', () => {
    const a = deterministicUuid('pay_success:ND-week-1');
    expect(a).toMatch(UUID_RE);
    expect(deterministicUuid('pay_success:ND-week-1')).toBe(a);
  });
  it('differs for different inputs', () => {
    expect(deterministicUuid('a')).not.toBe(deterministicUuid('b'));
  });
});

describe('buildPaymentCaptureArgs', () => {
  it('builds a success capture keyed on email with deterministic insert id', () => {
    const args = buildPaymentCaptureArgs({
      email: 'a@b.com',
      event: 'payment_succeeded',
      orderId: 'ND-week-1719700000000',
      plan: 'week',
      amount: 99,
      currency: 'UAH',
      utmSource: 'instagram',
    });
    expect(args.distinctId).toBe('a@b.com');
    expect(args.event).toBe('payment_succeeded');
    expect(args.properties.$insert_id).toBe('pay_success:ND-week-1719700000000');
    expect(args.properties.plan).toBe('week');
    expect(args.properties.amount).toBe(99);
    expect(args.properties.utm_source).toBe('instagram');
  });

  // Раніше timestamp = час створення orderId, тобто РАНІШЕ за checkout_started
  // і redirected_to_liqpay — впорядкована воронка в PostHog не зараховувала
  // такі оплати. Подія має нести реальний час, коли платіж підтверджено.
  it('does not backdate the event to the order creation time', () => {
    const args = buildPaymentCaptureArgs({
      email: 'a@b.com',
      event: 'payment_succeeded',
      orderId: 'ND-week-1719700000000',
    });
    expect(args.timestamp).toBeUndefined();
  });

  it('derives the PostHog uuid from the insert id so retries deduplicate', () => {
    const args = buildPaymentCaptureArgs({
      email: 'a@b.com',
      event: 'payment_succeeded',
      orderId: 'ND-week-1719700000000',
    });
    expect(args.uuid).toBe(deterministicUuid('pay_success:ND-week-1719700000000'));
  });

  it('uses the failed insert id for payment_failed', () => {
    const args = buildPaymentCaptureArgs({
      email: 'a@b.com',
      event: 'payment_failed',
      orderId: 'ND-month-1719700000001',
      status: 'failure',
    });
    expect(args.properties.$insert_id).toBe('pay_failed:ND-month-1719700000001');
    expect(args.properties.status).toBe('failure');
    expect(args.uuid).toBe(deterministicUuid('pay_failed:ND-month-1719700000001'));
  });
});
