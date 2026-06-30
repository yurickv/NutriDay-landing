import { describe, it, expect } from 'vitest';
import { parseOrderId, paymentSuccessInsertId, paymentFailedInsertId } from './payment';

describe('parseOrderId', () => {
  it('parses plan and epoch ms', () => {
    expect(parseOrderId('ND-week-1719700000000')).toEqual({ plan: 'week', ts: 1719700000000 });
  });
  it('parses month plan', () => {
    expect(parseOrderId('ND-month-1719700000001')).toEqual({ plan: 'month', ts: 1719700000001 });
  });
  it('returns nulls for malformed id', () => {
    expect(parseOrderId('garbage')).toEqual({ plan: null, ts: null });
  });
});

describe('insert ids', () => {
  it('builds deterministic success insert id', () => {
    expect(paymentSuccessInsertId('ND-week-1')).toBe('pay_success:ND-week-1');
  });
  it('builds deterministic failed insert id', () => {
    expect(paymentFailedInsertId('ND-week-1')).toBe('pay_failed:ND-week-1');
  });
});
