import { describe, it, expect } from 'vitest';
import { buildPaymentCaptureArgs } from './posthog.server';

describe('buildPaymentCaptureArgs', () => {
  it('builds a success capture keyed on email with deterministic insert id + timestamp', () => {
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
    expect(args.timestamp).toEqual(new Date(1719700000000));
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
  });

  it('leaves timestamp undefined for a malformed order id', () => {
    const args = buildPaymentCaptureArgs({ email: 'a@b.com', event: 'payment_failed', orderId: 'x' });
    expect(args.timestamp).toBeUndefined();
  });
});
